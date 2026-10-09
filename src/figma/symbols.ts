import { sourceId, type Sketch } from "../core/types";
import { imageHash, solidPaint } from "./appearance";
import { readData, writeData } from "./storage";
import { loadCurrentFonts } from "./typography";
import type { ImportContext } from "./context";
/** Sketch paths contain nested Symbol IDs and the target ID, omitting ordinary groups. */
export function overrideTarget(
  instance: InstanceNode,
  path: string[],
): SceneNode | undefined {
  let container: SceneNode = instance;
  for (const id of path) {
    if (!("children" in container)) return undefined;
    const find=(nodes:readonly SceneNode[]):SceneNode|undefined=>{
      for(const node of nodes){const source=node.getPluginData("sketch2figma:sourceId");if(source===id)return node;if(node.type!=="INSTANCE"&&"children" in node){const nested=find(node.children);if(nested)return nested;}}return undefined;
    };
    const found=find(container.children);
    if (!found) return undefined;
    container = found;
  }
  return container;
}
async function propertyOverride(root:InstanceNode,target:SceneNode,field:"characters"|"visible"|"mainComponent",value:string|boolean):Promise<boolean>{
 const key=target.componentPropertyReferences?.[field];if(!key)return false;
 let owner:BaseNode|null=target.parent;
 while(owner){if(owner.type==="INSTANCE"&&(await owner.getMainComponentAsync())?.componentPropertyDefinitions[key]){owner.setProperties({[key]:value});return true;}if(owner.id===root.id)break;owner=owner.parent;}
 return false;
}
export async function applyOverrides(
  ctx: ImportContext,
  s: Sketch,
  instance: InstanceNode,
): Promise<void> {
  // Swap ancestor instances before applying deeper text/image overrides.
  const overrides = [...(s.overrideValues ?? [])]
    .map((o: Sketch, i: number) => ({ o, i }))
    .sort((a,b)=>{
      const priority=(name:string)=>name.endsWith("_symbolID")?0:/_(layerStyle|textStyle)$/.test(name)?1:2;
      return priority(a.o.overrideName)-priority(b.o.overrideName)||a.o.overrideName.split("/").length-b.o.overrideName.split("/").length;
    });
  for (const { o, i } of overrides) {
    const match = String(o.overrideName).match(/^(.*)_([^_]+)$/),
      path = `/overrideValues/${i}`;
    if (!match) {
      ctx.finding(
        "OVERRIDE_NAME",
        "Unrecognized Symbol override name.",
        s,
        path,
      );
      continue;
    }
    const ids = match[1].split("/"),
      kind = match[2],
      target = overrideTarget(instance, ids);
    if (!target) {
      ctx.finding(
        "OVERRIDE_TARGET",
        `Missing target ${match[1]} in linked instance.`,
        s,
        path,
      );
      continue;
    }
    const ok = await ctx.attempt(
      s,
      path,
      async () => {
        if (
          kind === "stringValue" &&
          (target.type === "TEXT" || target.type === "TEXT_PATH")
        ) {
          await loadCurrentFonts(ctx, target);
          if(!await propertyOverride(instance,target,"characters",String(o.value)))target.characters = String(o.value);
        } else if (kind === "isVisible") {
          const value=o.value !== false && o.value !== 0 && o.value !== "0";
          if(!await propertyOverride(instance,target,"visible",value))target.visible=value;
        } else if (kind === "symbolID" && target.type === "INSTANCE") {
          if (o.value === "") target.visible = false;
          else {
            const master = ctx.resources.components.get(String(o.value));
            if (!master) throw new Error(`Unresolved Symbol swap ${o.value}`);
            if(!await propertyOverride(instance,target,"mainComponent",master.id))target.swapComponent(master);
          }
        } else if(kind === "textColor" && (target.type==="TEXT"||target.type==="TEXT_PATH")){
          target.fills=[solidPaint(ctx,s,o.value,`${path}/value`)];
        } else if(/^color:(fill|border)-\d+$/.test(kind)){
          const colorMatch=kind.match(/^color:(fill|border)-(\d+)$/)!;
          const field=colorMatch[1]==="fill"?"fills":"strokes",index=Number(colorMatch[2]);
          if(!(field in target))throw new Error(`Target does not support ${field}.`);
          const current=(target as unknown as Sketch)[field] as readonly Paint[]|symbol;
          if(typeof current==="symbol"||!current[index]||current[index].type!=="SOLID")throw new Error(`Color override ${kind} requires an existing solid paint.`);
          const fills=[...current],color=solidPaint(ctx,s,o.value,`${path}/value`);
          fills[index]={...fills[index],color:color.color,opacity:color.opacity,boundVariables:color.boundVariables} as SolidPaint;
          (target as unknown as Sketch)[field]=fills;
        } else if (kind === "image" && "fills" in target) {
          const hash = await imageHash(ctx, o.value);
          if (!hash) throw new Error("Missing override image");
          const fills = typeof target.fills === "symbol" ? [] : target.fills;
          target.fills = fills.map((p) =>
            p.type === "IMAGE" ? { ...p, imageHash: hash } : p,
          );
        } else if (kind === "layerStyle" && "setFillStyleIdAsync" in target) {
          const paint = ctx.resources.paints.get(String(o.value));
          const effect = ctx.resources.effects.get(String(o.value));
          const stroke=ctx.resources.strokes.get(String(o.value));
          if (!paint && !effect && !stroke)
            throw new Error("Missing layer style override");
          if (paint) target.fills = paint;
          if(stroke && "strokes" in target) target.strokes = stroke;
          if (effect && "setEffectStyleIdAsync" in target)
            await target.setEffectStyleIdAsync(effect.id);
        } else if (kind === "textStyle" && target.type === "TEXT") {
          const style = ctx.resources.texts.get(String(o.value));
          if (!style) throw new Error("Missing text style override");
          await loadCurrentFonts(ctx, target);
          await ctx.api.loadFontAsync(style.fontName);
          await target.setTextStyleIdAsync(style.id);
          const paint=ctx.resources.paints.get(String(o.value));if(paint)target.fills = paint;
        } else
          throw new Error(
            `Unsupported override ${kind}; original override retained.`,
          );
      },
      ["_class", "overrideName", "value"],
    );
    if (ok && kind === "symbolID" && o.value === "")
      ctx.ledger(s).mark(`${path}/value`, "Editable Equivalent", "Empty Sketch Symbol swap represented by native instance visibility.");
    if (ok && typeof o.value === "object")
      ctx.ledger(s).fields(`${path}/value`, ["_class", "_ref_class", "_ref"]);
  }
}
export async function componentProperties(
  ctx: ImportContext,
  s: Sketch,
  component: ComponentNode,
): Promise<void> {
  const owned=readData<Record<string,string>>(component,"componentProperties",{});
  // No state-name heuristics or variants are inferred from source naming.
  for (const [i, p] of (s.overrideProperties ?? []).entries()) {
    const name = String(p.overrideName ?? ""),
      m = name.match(/^(.*)_(stringValue|isVisible|symbolID)$/);
    if (!m || p.canOverride === false) continue;
    const target = overrideTarget(
      component as unknown as InstanceNode,
      m[1].split("/"),
    );
    if (!target) continue;
    try {
      const type =
        m[2] === "stringValue"
          ? "TEXT"
          : m[2] === "isVisible"
            ? "BOOLEAN"
            : "INSTANCE_SWAP";
      const initial = type === "TEXT" && "characters" in target ? target.characters
        : type === "BOOLEAN" ? target.visible
        : target.type === "INSTANCE" ? (await target.getMainComponentAsync())?.id : undefined;
      if(initial===undefined)continue;
      const existing=owned[name];
      const id=existing && component.componentPropertyDefinitions[existing]?.type===type
        ? component.editComponentProperty(existing,{defaultValue:initial})
        : component.addComponentProperty(`${target.name} / ${m[2]}`,type,initial);
      owned[name]=id;
      target.componentPropertyReferences = {
        ...target.componentPropertyReferences,
        [type === "TEXT"
          ? "characters"
          : type === "BOOLEAN"
            ? "visible"
            : "mainComponent"]: id,
      };
      ctx
        .ledger(s)
        .fields(
          `/overrideProperties/${i}`,
          ["_class", "overrideName", "canOverride"],
          "Partial",
          "Supported override exposed as a native component property; Sketch override-permission semantics differ.",
        );
    } catch (e) {
      ctx.finding(
        "COMPONENT_PROPERTY",
        String(e),
        s,
        `/overrideProperties/${i}`,
      );
    }
  }
  writeData(component,"componentProperties",owned);
}
