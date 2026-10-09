/** Deliberately limited host double. Does not simulate Figma rendering or Auto Layout. */
import { fingerprint } from "../src/core/math";
export function createHost({
  semanticOverrides = false,
}: { semanticOverrides?: boolean } = {}) {
  let serial = 1;
  const nodes = new Map<string, any>(),
    styles = new Map<string, any>(),
    variables = new Map<string, any>(),
    collections = new Map<string, any>(),
    loaded = new Set<string>();
  class Node {
    id = String(serial++);
    name = "";
    parent: any = null;
    removed = false;
    children: Node[] = [];
    visible = true;
    locked = false;
    opacity = 1;
    blendMode = "NORMAL";
    width = 100;
    height = 100;
    relativeTransform: number[][] = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    fills: any[] = [];
    strokes: any[] = [];
    effects: any[] = [];
    strokeWeight = 1;
    strokeAlign = "CENTER";
    strokeCap = "NONE";
    strokeJoin = "MITER";
    strokeMiterLimit = 4;
    dashPattern: any[] = [];
    exportSettings: any[] = [];
    isMask = false;
    maskType = "ALPHA";
    constraints = { horizontal: "MIN", vertical: "MIN" };
    cornerRadius = 0;
    topLeftRadius = 0;
    topRightRadius = 0;
    bottomRightRadius = 0;
    bottomLeftRadius = 0;
    cornerSmoothing = 0;
    itemReverseZIndex = false;
    counterAxisAlignContent = "AUTO";
    clipsContent = false;
    layoutMode = "NONE";
    layoutWrap = "NO_WRAP";
    itemSpacing = 0;
    counterAxisSpacing = 0;
    paddingTop = 0;
    paddingRight = 0;
    paddingBottom = 0;
    paddingLeft = 0;
    primaryAxisAlignItems = "MIN";
    counterAxisAlignItems = "MIN";
    primaryAxisSizingMode = "FIXED";
    counterAxisSizingMode = "FIXED";
    layoutSizingHorizontal = "FIXED";
    layoutSizingVertical = "FIXED";
    layoutPositioning = "AUTO";
    layoutGrow = 0;
    layoutAlign = "INHERIT";
    minWidth = null;
    maxWidth = null;
    minHeight = null;
    maxHeight = null;
    overflowDirection = "NONE";
    numberOfFixedChildren = 0;
    guides: any[] = [];
    layoutGrids: any[] = [];
    backgrounds: any[] = [];
    flowStartingPoints: any[] = [];
    documentColorProfile = "SRGB";
    fillStyleId = "";
    strokeStyleId = "";
    effectStyleId = "";
    textStyleId = "";
    reactions: any[] = [];
    data: Record<string, string> = {};
    vectorPaths: any[] = [];
    vectorNetwork: any = { vertices: [], segments: [] };
    fontName: any = { family: "Inter", style: "Regular" };
    fontSize = 12;
    lineHeight: any = { unit: "AUTO" };
    letterSpacing: any = { unit: "PIXELS", value: 0 };
    textCase = "ORIGINAL";
    textDecoration = "NONE";
    textAutoResize = "NONE";
    textAlignHorizontal = "LEFT";
    textAlignVertical = "TOP";
    paragraphSpacing = 0;
    paragraphIndent = 0;
    listSpacing = 0;
    textWrapStyle = "AUTO";
    leadingTrim = "NONE";
    hangingPunctuation = false;
    hangingList = false;
    textTruncation = "DISABLED";
    _characters = "";
    runs: any[] = [];
    main: any;
    constructor(public type: string) {
      nodes.set(this.id, this);
    }
    get x() {
      return this.relativeTransform[0][2];
    }
    set x(n: number) {
      this.relativeTransform[0][2] = n;
    }
    get y() {
      return this.relativeTransform[1][2];
    }
    set y(n: number) {
      this.relativeTransform[1][2] = n;
    }
    get characters() {
      return this._characters;
    }
    set characters(v: string) {
      if (this.type === "TEXT" && !loaded.has(JSON.stringify(this.fontName)))
        throw new Error("Font not loaded");
      this._characters = v;
      this.runs = [];
    }
    resize(w: number, h: number) {
      if (w <= 0 || h <= 0) throw new Error("Bounds must be positive");
      this.width = w;
      this.height = h;
    }
    appendChild(n: Node) {
      this.insertChild(this.children.length, n);
    }
    insertChild(at: number, n: Node) {
      if (n.parent) {
        n.parent.children = n.parent.children.filter((c: Node) => c !== n);
      }
      this.children.splice(Math.min(at, this.children.length), 0, n);
      n.parent = this;
    }
    remove() {
      for (const c of [...this.children]) c.remove();
      if (this.parent)
        this.parent.children = this.parent.children.filter(
          (c: Node) => c !== this,
        );
      this.removed = true;
      nodes.delete(this.id);
    }
    clone() {
      const n = new Node(this.type);
      for (const key of Object.keys(this)) {
        if (["id", "parent", "children", "removed", "main"].includes(key))
          continue;
        (n as any)[key] = JSON.parse(JSON.stringify((this as any)[key]));
      }
      n.main = this.main;
      for (const c of this.children) n.appendChild(c.clone());
      return n;
    }
    findAll(predicate: (node: Node) => boolean) {
      const found: Node[] = [];
      const visit = (node: Node) => {
        for (const child of node.children) {
          if (predicate(child)) found.push(child);
          visit(child);
        }
      };
      visit(this);
      return found;
    }
    getPluginData(k: string) {
      return this.data[k] ?? "";
    }
    setPluginData(k: string, v: string) {
      if (v.length > 100000) throw new Error("Plugin data too large");
      if (v) this.data[k] = v;
      else delete this.data[k];
    }
    getPluginDataKeys() {
      return Object.keys(this.data);
    }
    setRelaunchData() {}
    async setFillStyleIdAsync(id: string) {
      this.fillStyleId = id;
      const style = styles.get(id);
      if (style) this.fills = structuredClone(style.paints);
    }
    async setStrokeStyleIdAsync(id: string) {
      this.strokeStyleId = id;
    }
    async setEffectStyleIdAsync(id: string) {
      this.effectStyleId = id;
    }
    async setTextStyleIdAsync(id: string) {
      this.runs = this.runs.filter(
        (r) =>
          ![
            "fontName",
            "fontSize",
            "lineHeight",
            "letterSpacing",
            "paragraphSpacing",
            "paragraphIndent",
            "textCase",
            "textDecoration",
            "textStyleId",
            "listSpacing",
            "textWrapStyle",
          ].includes(r.field) && !r.field.startsWith("bound:"),
      );
      this.textStyleId = id;
      const style = styles.get(id);
      if (style)
        for (const k of [
          "fontName",
          "fontSize",
          "lineHeight",
          "letterSpacing",
          "paragraphSpacing",
          "paragraphIndent",
          "textCase",
          "textDecoration",
          "listSpacing",
          "textWrapStyle",
          "leadingTrim",
          "hangingPunctuation",
          "hangingList",
        ])
          (this as any)[k] = structuredClone(style[k] ?? 0);
      if (style)
        for (const [field, alias] of Object.entries(style.boundVariables ?? {}))
          this.rangeSet(
            "bound:" + field,
            0,
            this.characters.length,
            alias,
            false,
          );
    }
    async setReactionsAsync(r: any[]) {
      this.reactions = r;
    }
    async setVectorNetworkAsync(n: any) {
      this.vectorNetwork = n;
    }
    createInstance() {
      const n = this.clone();
      n.type = "INSTANCE";
      n.main = this;
      return n;
    }
    async getMainComponentAsync() {
      return this.main;
    }
    swapComponent(c: Node) {
      for (const n of this.children) n.remove();
      for (const n of c.children) this.appendChild(n.clone());
      this.main = c;
    }
    componentPropertyDefinitions: Record<string, any> = {};
    addComponentProperty(name: string, type: string, value: any) {
      const id = name + "#" + serial++;
      this.componentPropertyDefinitions[id] = { type, defaultValue: value };
      return id;
    }
    editComponentProperty(name: string, value: any) {
      this.componentPropertyDefinitions[name] = {
        ...this.componentPropertyDefinitions[name],
        ...value,
      };
      return name;
    }
    removeOverrides() {
      if (this.main) {
        // Observed native behavior: instance-root plugin data returns to the
        // main component's values. Importer identity must be stamped afterward.
        this.data = { ...this.main.data };
        for (const n of [...this.children]) n.remove();
        for (const n of this.main.children) this.appendChild(n.clone());
      }
    }
    getRangeFontName(a = 0, b = this.characters.length) {
      return this.rangeValue("fontName", a, b);
    }
    getRangeFontSize(a = 0, b = this.characters.length) {
      return this.rangeValue("fontSize", a, b);
    }
    getRangeLetterSpacing(a = 0, b = this.characters.length) {
      return this.rangeValue("letterSpacing", a, b);
    }
    getRangeLineHeight(a = 0, b = this.characters.length) {
      return this.rangeValue("lineHeight", a, b);
    }
    getRangeTextCase(a = 0, b = this.characters.length) {
      return this.rangeValue("textCase", a, b);
    }
    getRangeTextDecoration(a = 0, b = this.characters.length) {
      return this.rangeValue("textDecoration", a, b);
    }
    getRangeParagraphSpacing(a = 0, b = this.characters.length) {
      return this.rangeValue("paragraphSpacing", a, b);
    }
    getRangeParagraphIndent(a = 0, b = this.characters.length) {
      return this.rangeValue("paragraphIndent", a, b);
    }
    setProperties(values: Record<string, string | boolean>) {
      const visit = (node: Node) => {
        for (const [field, key] of Object.entries(
          node.componentPropertyReferences ?? {},
        )) {
          if ((key as string) in values) {
            if (field === "mainComponent") {
              const c = nodes.get(String(values[key as string]));
              if (c) node.swapComponent(c);
            } else (node as any)[field] = values[key as string];
          }
        }
        for (const child of node.children) visit(child);
      };
      for (const child of this.children) visit(child);
    }
    getRangeFills(a = 0, b = this.characters.length) {
      return this.rangeValue("fills", a, b);
    }
    getRangeFillStyleId(a = 0, b = this.characters.length) {
      return this.rangeValue("fillStyleId", a, b);
    }
    getRangeListOptions() {
      return { type: "NONE" };
    }
    getRangeListSpacing(a = 0, b = this.characters.length) {
      return this.rangeValue("listSpacing", a, b);
    }
    async setRangeFillStyleIdAsync(a: number, b: number, id: string) {
      const style = styles.get(id);
      if (style) this.rangeSet("fills", a, b, style.paints, false);
      this.rangeSet("fillStyleId", a, b, id, false);
    }
    getRangeTextStyleId(a = 0, b = this.characters.length) {
      return this.rangeValue("textStyleId", a, b);
    }
    boundVariables: Record<string, any> = {};
    getRangeBoundVariable(a: number, b: number, field: string) {
      const value = this.rangeValue("bound:" + field, a, b);
      return value === api.mixed ? null : value;
    }
    setRangeBoundVariable(a: number, b: number, field: string, variable: any) {
      this.rangeSet(
        "bound:" + field,
        a,
        b,
        variable ? { type: "VARIABLE_ALIAS", id: variable.id } : null,
        false,
      );
    }
    setBoundVariable(field: string, variable: any) {
      if (
        this.type === "TEXT" &&
        [
          "fontFamily",
          "fontStyle",
          "fontWeight",
          "fontSize",
          "letterSpacing",
          "lineHeight",
          "paragraphSpacing",
          "paragraphIndent",
        ].includes(field)
      ) {
        this.setRangeBoundVariable(0, this.characters.length, field, variable);
        if (variable)
          this.boundVariables[field] = [
            { type: "VARIABLE_ALIAS", id: variable.id },
          ];
        else delete this.boundVariables[field];
        return;
      }
      if (variable)
        this.boundVariables[field] = {
          type: "VARIABLE_ALIAS",
          id: variable.id,
        };
      else delete this.boundVariables[field];
    }
    componentPropertyReferences: any = {};
    getRangeAllFontNames(start: number, end: number) {
      if (end <= start)
        throw new Error(
          "in getRangeAllFontNames: Empty range selected. 'end' must be greater than 'start'",
        );
      if (start < 0 || end > this.characters.length)
        throw new Error("in getRangeAllFontNames: Invalid character range");
      const fonts = this.getStyledTextSegments()
        .filter((s) => s.start < end && s.end > start)
        .map((s) => s.fontName);
      return [...new Map(fonts.map((f) => [JSON.stringify(f), f])).values()];
    }
    private rangeValue(field: string, a: number, b: number) {
      const segments = this.getStyledTextSegments().filter(
          (s) => s.start < b && s.end > a,
        ),
        values = segments.map((s) => s[field]);
      return values.length &&
        values.every((v) => fingerprint(v) === fingerprint(values[0]))
        ? values[0]
        : api.mixed;
    }
    private rangeSet(
      field: string,
      a: number,
      b: number,
      value: any,
      detach = true,
    ) {
      if (
        detach &&
        [
          "fontName",
          "fontSize",
          "lineHeight",
          "letterSpacing",
          "paragraphSpacing",
          "paragraphIndent",
          "textCase",
          "textDecoration",
          "listSpacing",
          "textWrapStyle",
        ].includes(field)
      )
        this.runs.push({ field: "textStyleId", start: a, end: b, value: "" });
      if (detach && field === "fills")
        this.runs.push({ field: "fillStyleId", start: a, end: b, value: "" });
      this.runs.push({
        field,
        start: a,
        end: b,
        value: structuredClone(value),
      });
    }
    getStyledTextSegments(..._args: any[]): any[] {
      if (!this.characters.length) return [];
      const boundaries = [
        ...new Set([
          0,
          this.characters.length,
          ...this.runs.flatMap((r) => [r.start, r.end]),
        ]),
      ]
        .filter((n) => n >= 0 && n <= this.characters.length)
        .sort((a, b) => a - b);
      return boundaries.slice(0, -1).map((start, i) => {
        const end = boundaries[i + 1],
          segment: any = {
            start,
            end,
            characters: this.characters.slice(start, end),
            fontName: this.fontName,
            fontSize: this.fontSize,
            fills: this.fills,
            letterSpacing: this.letterSpacing,
            lineHeight: this.lineHeight,
            textCase: this.textCase,
            textDecoration: this.textDecoration,
            textStyleId: this.textStyleId,
            fillStyleId: this.fillStyleId,
            boundVariables: Object.fromEntries(
              this.runs
                .filter(
                  (r) =>
                    r.field.startsWith("bound:") &&
                    r.start <= start &&
                    r.end >= end &&
                    r.value,
                )
                .map((r) => [r.field.slice(6), r.value]),
            ),
            listOptions: { type: "NONE" },
            paragraphIndent: this.paragraphIndent,
            paragraphSpacing: this.paragraphSpacing,
            listSpacing: this.listSpacing,
            textWrapStyle: this.textWrapStyle,
          };
        for (const r of this.runs)
          if (r.start <= start && r.end >= end) segment[r.field] = r.value;
        return segment;
      });
    }
    setRangeFontName(a: number, b: number, v: any) {
      if (!loaded.has(JSON.stringify(v))) throw new Error("Font not loaded");
      const current = this.getRangeFontName(a, b);
      const semantic =
        semanticOverrides &&
        current !== api.mixed &&
        current.family === v.family &&
        [current.style, v.style].every((style) =>
          /^(Regular|Bold|Italic|Bold Italic)$/.test(style),
        );
      this.rangeSet("fontName", a, b, v, !semantic);
    }
    setRangeFontSize(a: number, b: number, v: any) {
      this.rangeSet("fontSize", a, b, v);
    }
    setRangeFills(a: number, b: number, v: any) {
      this.rangeSet("fills", a, b, v);
    }
    setRangeLetterSpacing(a: number, b: number, v: any) {
      this.rangeSet("letterSpacing", a, b, v);
    }
    setRangeLineHeight(a: number, b: number, v: any) {
      this.rangeSet("lineHeight", a, b, v);
    }
    setRangeTextCase(a: number, b: number, v: any) {
      this.rangeSet("textCase", a, b, v);
    }
    setRangeTextDecoration(a: number, b: number, v: any) {
      this.rangeSet("textDecoration", a, b, v, !semanticOverrides);
    }
    setRangeParagraphSpacing(a: number, b: number, v: any) {
      this.rangeSet("paragraphSpacing", a, b, v);
    }
    setRangeParagraphIndent(a: number, b: number, v: any) {
      this.rangeSet("paragraphIndent", a, b, v);
    }
    setRangeListSpacing(a: number, b: number, v: any) {
      this.rangeSet("listSpacing", a, b, v);
    }
    getRangeTextWrapStyle(a = 0, b = this.characters.length) {
      return this.rangeValue("textWrapStyle", a, b);
    }
    setRangeTextWrapStyle(a: number, b: number, v: any) {
      this.rangeSet("textWrapStyle", a, b, v);
    }
    setRangeListOptions() {}
    async setRangeTextStyleIdAsync(a: number, b: number, v: any) {
      const style = styles.get(v);
      if (style)
        for (const key of [
          "fontName",
          "fontSize",
          "lineHeight",
          "letterSpacing",
          "paragraphSpacing",
          "paragraphIndent",
          "textCase",
          "textDecoration",
          "listSpacing",
          "textWrapStyle",
        ])
          this.rangeSet(key, a, b, style[key] ?? 0, false);
      if (style) {
        for (const field of [
          "leadingTrim",
          "hangingPunctuation",
          "hangingList",
        ])
          (this as any)[field] = style[field];
        for (const field of [
          "fontFamily",
          "fontStyle",
          "fontWeight",
          "fontSize",
          "letterSpacing",
          "lineHeight",
          "paragraphIndent",
          "paragraphSpacing",
        ])
          this.rangeSet(
            "bound:" + field,
            a,
            b,
            style.boundVariables?.[field] ?? undefined,
            false,
          );
      }
      this.rangeSet("textStyleId", a, b, v, false);
    }
  }
  const root = new Node("DOCUMENT"),
    page = new Node("PAGE");
  page.name = "Page 1";
  root.appendChild(page);
  const make = (type: string) => {
    const n = new Node(type);
    api.currentPage.appendChild(n);
    return n;
  };
  const style = (type: string) => {
    const r: any = {
      id: "style:" + serial++,
      type,
      name: "",
      paints: [],
      effects: [],
      fontName: { family: "Inter", style: "Regular" },
      fontSize: 12,
      lineHeight: { unit: "AUTO" },
      letterSpacing: { unit: "PIXELS", value: 0 },
      paragraphSpacing: 0,
      paragraphIndent: 0,
      listSpacing: 0,
      textWrapStyle: "AUTO",
      leadingTrim: "NONE",
      hangingPunctuation: false,
      hangingList: false,
      textCase: "ORIGINAL",
      textDecoration: "NONE",
      boundVariables: {},
      data: {} as Record<string, string>,
      description: "",
      getPluginData(key: string) {
        return this.data[key] ?? "";
      },
      getPluginDataKeys() {
        return Object.keys(this.data);
      },
      setPluginData(key: string, value: string) {
        if (value) this.data[key] = value;
        else delete this.data[key];
      },
      setBoundVariable(field: string, variable: any) {
        if (variable)
          this.boundVariables[field] = {
            type: "VARIABLE_ALIAS",
            id: variable.id,
          };
        else delete this.boundVariables[field];
      },
      remove() {
        styles.delete(this.id);
      },
    };
    styles.set(r.id, r);
    return r;
  };
  const group = (children: Node[], parent: Node, type = "GROUP") => {
    const n = new Node(type);
    parent.appendChild(n);
    n.x = Math.min(...children.map((c) => c.x));
    n.y = Math.min(...children.map((c) => c.y));
    n.width = Math.max(...children.map((c) => c.x + c.width)) - n.x;
    n.height = Math.max(...children.map((c) => c.y + c.height)) - n.y;
    for (const c of children) {
      const x = c.x - n.x,
        y = c.y - n.y;
      n.appendChild(c);
      c.x = x;
      c.y = y;
    }
    return n;
  };
  const api: any = {
    apiVersion: "1.0.0",
    root,
    currentPage: page,
    mixed: Symbol("mixed"),
    createPage() {
      const p = new Node("PAGE");
      root.appendChild(p);
      return p;
    },
    createFrame: () => make("FRAME"),
    createComponent: () => make("COMPONENT"),
    createText: () => make("TEXT"),
    createVector: () => make("VECTOR"),
    createRectangle: () => make("RECTANGLE"),
    createEllipse: () => make("ELLIPSE"),
    createSlice: () => make("SLICE"),
    createPolygon: () => make("POLYGON"),
    createStar: () => make("STAR"),
    group,
    // API orchestration only: glyph outlines / boolean evaluation are not
    // simulated. The text fallback is a box, never a pixel-fidelity assertion.
    flatten: (children: Node[], parent: Node) => {
      const input = children[0],
        n = new Node("VECTOR");
      parent.appendChild(n);
      n.relativeTransform = structuredClone(input.relativeTransform);
      n.width = input.width;
      n.height = input.height;
      n.vectorNetwork =
        input.type === "VECTOR"
          ? structuredClone(input.vectorNetwork)
          : {
              vertices: [
                { x: 0, y: 0 },
                { x: input.width, y: 0 },
                { x: input.width, y: input.height },
                { x: 0, y: input.height },
              ],
              segments: [
                { start: 0, end: 1 },
                { start: 1, end: 2 },
                { start: 2, end: 3 },
                { start: 3, end: 0 },
              ],
              regions: [{ windingRule: "NONZERO", loops: [[0, 1, 2, 3]] }],
            };
      for (const child of children) child.remove();
      return n;
    },
    union: (c: Node[], p: Node) => {
      const n = group(c, p, "BOOLEAN_OPERATION");
      (n as any).booleanOperation = "UNION";
      return n;
    },
    subtract: (c: Node[], p: Node) => {
      const n = group(c, p, "BOOLEAN_OPERATION");
      (n as any).booleanOperation = "SUBTRACT";
      return n;
    },
    intersect: (c: Node[], p: Node) => {
      const n = group(c, p, "BOOLEAN_OPERATION");
      (n as any).booleanOperation = "INTERSECT";
      return n;
    },
    exclude: (c: Node[], p: Node) => {
      const n = group(c, p, "BOOLEAN_OPERATION");
      (n as any).booleanOperation = "EXCLUDE";
      return n;
    },
    createPaintStyle: () => style("PAINT"),
    createTextStyle: () => style("TEXT"),
    createEffectStyle: () => style("EFFECT"),
    getStyleByIdAsync: async (id: string) => styles.get(id) ?? null,
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    loadAllPagesAsync: async () => {},
    setCurrentPageAsync: async (p: Node) => {
      api.currentPage = p;
    },
    listAvailableFontsAsync: async () => [
      { fontName: { family: "Inter", style: "Regular" } },
      { fontName: { family: "Arial", style: "Regular" } },
      { fontName: { family: "Arial", style: "Bold" } },
    ],
    loadFontAsync: async (f: any) => {
      loaded.add(JSON.stringify(f));
    },
    getFontFamilyVariationAxes: () => null,
    createImage: (bytes: Uint8Array) => ({ hash: fingerprint([...bytes]) }),
    importComponentByKeyAsync: async () => {
      throw new Error("No published library in host double");
    },
    variables: {
      createVariableCollection(name: string) {
        const c: any = {
          id: "collection:" + serial++,
          name,
          defaultModeId: "mode:" + serial++,
          get variableIds() {
            return [...variables.values()]
              .filter((v) => v.variableCollectionId === this.id)
              .map((v) => v.id);
          },
          modes: [] as any[],
          addMode(name: string) {
            const id = "mode:" + serial++;
            this.modes.push({ modeId: id, name });
            return id;
          },
          renameMode(id: string, name: string) {
            this.modes.find((m: any) => m.modeId === id).name = name;
          },
          removeMode(id: string) {
            this.modes = this.modes.filter((m: any) => m.modeId !== id);
          },
          remove() {
            collections.delete(this.id);
          },
        };
        c.modes = [{ modeId: c.defaultModeId, name: "Mode 1" }];
        collections.set(c.id, c);
        return c;
      },
      createVariable(name: string, collection: any, resolvedType: string) {
        const v: any = {
          id: "variable:" + serial++,
          name,
          variableCollectionId: collection.id,
          resolvedType,
          scopes: [],
          valuesByMode: {},
          setValueForMode(id: string, value: any) {
            this.valuesByMode[id] = value;
          },
          remove() {
            variables.delete(this.id);
          },
        };
        variables.set(v.id, v);
        return v;
      },
      getVariableByIdAsync: async (id: string) => variables.get(id) ?? null,
      getVariableCollectionByIdAsync: async (id: string) =>
        collections.get(id) ?? null,
      setBoundVariableForPaint: (p: any, f: string, v: any) => ({
        ...p,
        boundVariables: { [f]: { type: "VARIABLE_ALIAS", id: v.id } },
      }),
      setBoundVariableForEffect: (p: any, f: string, v: any) => ({
        ...p,
        boundVariables: { [f]: { type: "VARIABLE_ALIAS", id: v.id } },
      }),
      createVariableAlias: (v: any) => ({ type: "VARIABLE_ALIAS", id: v.id }),
    },
  };
  return {
    api: api as PluginAPI,
    nodes,
    styles,
    variables,
    collections,
    loaded,
  };
}
