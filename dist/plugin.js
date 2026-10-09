"use strict";
(() => {
  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i2 = 0; i2 < 31; ++i2) {
      b[i2] = start += 1 << eb[i2 - 1];
    }
    var r = new i32(b[30]);
    for (var i2 = 1; i2 < 30; ++i2) {
      for (var j = b[i2]; j < b[i2 + 1]; ++j) {
        r[j] = j - b[i2] << 5 | i2;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i2 = 0;
    var l = new u16(mb);
    for (; i2 < s; ++i2) {
      if (cd[i2])
        ++l[cd[i2] - 1];
    }
    var le = new u16(mb);
    for (i2 = 1; i2 < mb; ++i2) {
      le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i2 = 0; i2 < s; ++i2) {
        if (cd[i2]) {
          var sv = i2 << 4 | cd[i2];
          var r_1 = mb - cd[i2];
          var v = le[cd[i2] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i2 = 0; i2 < s; ++i2) {
        if (cd[i2]) {
          co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i2 = 1; i2 < a.length; ++i2) {
      if (a[i2] > m)
        m = a[i2];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf;
    var resize = noBuf || st.i != 2;
    var noSt = st.i;
    if (noBuf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i2 = 0; i2 < hcLen; ++i2) {
            clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i2 = 0; i2 < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i2++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i2++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (resize)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i2 = sym - 257, b = fleb[i2];
            add = bits(dat, pos, (1 << b) - 1) + fl[i2];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift = dl - dt, dend = Math.min(dt, end);
            if (shift + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift + bt];
          }
          for (; bt < end; ++bt)
            buf[bt] = buf[bt - dt];
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i2 = 0; i2 < d.length; ++i2) {
      if (d[i2])
        t.push({ s: i2, f: d[i2] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i22].f ? i0++ : i22++];
      r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i2 = 1; i2 < s; ++i2) {
      if (t2[i2].s > maxSym)
        maxSym = t2[i2].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i2 = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i2 < s; ++i2) {
        var i2_1 = t2[i2].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i2].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i2;
      }
      for (; i2 >= 0 && dt; --i2) {
        var i2_3 = t2[i2].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i2 = 1; i2 <= s; ++i2) {
      if (c[i2] == cln && i2 != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i2];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i2 = 0; i2 < cl.length; ++i2)
      l += cf[i2] * cl[i2];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i2 = 0; i2 < s; ++i2)
      out[o + i2 + 4] = dat[i2];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i2 = 0; i2 < lclt.length; ++i2)
      ++lcfreq[lclt[i2] & 31];
    for (var i2 = 0; i2 < lcdt.length; ++i2)
      ++lcfreq[lcdt[i2] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i2 = 0; i2 < nlcc; ++i2)
        wbits(out, p + 3 * i2, lct[clim[i2]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i2 = 0; i2 < clct.length; ++i2) {
          var len = clct[i2] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i2 = 0; i2 < li; ++i2) {
      var sym = syms[i2];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i3) {
        return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i2 + 2 < s; ++i2) {
        var hv = hsh(i2);
        var imod = i2 & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i2) {
          var rem = s - i2;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
            li = lc_1 = eb = 0, bs = i2;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i2 - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i2);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i2 + l] == dat[i2 + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i2 - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i2 + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i2];
            ++lf[dat[i2]];
          }
        }
      }
      for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
        syms[li++] = dat[i2];
        ++lf[dat[i2]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i2, st.w = wi;
      }
    } else {
      for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
        var e = i2 + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i2, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var adler = function() {
    var a = 1, b = 0;
    return {
      p: function(d) {
        var n = a, m = b;
        var l = d.length | 0;
        for (var i2 = 0; i2 != l; ) {
          var e = Math.min(i2 + 2655, l);
          for (; i2 < e; ++i2)
            m += n += d[i2];
          n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
        }
        a = n, b = m;
      },
      d: function() {
        a %= 65521, b %= 65521;
        return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  var zlh = function(c, o) {
    var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
    c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
    c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
    if (o.dictionary) {
      var h = adler();
      h.p(o.dictionary);
      wbytes(c, 2, h.d());
    }
  };
  var zls = function(d, dict) {
    if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
      err(6, "invalid zlib data");
    if ((d[1] >> 5 & 1) == +!dict)
      err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
    return (d[1] >> 3 & 4) + 2;
  };
  function zlibSync(data, opts) {
    if (!opts)
      opts = {};
    var a = adler();
    a.p(data);
    var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
    return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
  }
  function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  var dutf8 = function(d) {
    for (var r = "", i2 = 0; ; ) {
      var c = d[i2++];
      var eb = (c > 127) + (c > 223) + (c > 239);
      if (i2 + eb > d.length)
        return { s: r, r: slc(d, i2 - 1) };
      if (!eb)
        r += String.fromCharCode(c);
      else if (eb == 3) {
        c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
      } else if (eb & 1)
        r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
      else
        r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
    }
  };
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i2 = 0; i2 < str.length; ++i2)
        ar_1[i2] = str.charCodeAt(i2);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i2 = 0; i2 < l; ++i2) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i2 << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i2);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  function strFromU8(dat, latin1) {
    if (latin1) {
      var r = "";
      for (var i2 = 0; i2 < dat.length; i2 += 16384)
        r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
      return r;
    } else if (td) {
      return td.decode(dat);
    } else {
      var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
      if (r.length)
        err(8);
      return s;
    }
  }

  // src/figma/property-equality.ts
  function sameFont(actual, expected) {
    return typeof actual !== "symbol" && actual.family === expected.family && actual.style === expected.style && Object.entries(expected.variationSettings ?? {}).every(
      ([tag, v]) => actual.variationSettings?.[tag] === v
    );
  }
  function sameValue(a, b) {
    if (typeof a === "number" && typeof b === "number")
      return Math.abs(a - b) < 1e-6;
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) || Array.isArray(b))
      return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i2) => sameValue(v, b[i2]));
    const x2 = a, y = b;
    return Object.keys(x2).length === Object.keys(y).length && Object.keys(x2).every((k) => sameValue(x2[k], y[k]));
  }
  function comparablePaint(p) {
    const bindings = "boundVariables" in p ? p.boundVariables : void 0;
    const base = {
      ...p,
      visible: p.visible ?? true,
      opacity: p.opacity ?? 1,
      blendMode: p.blendMode ?? "NORMAL",
      boundVariables: Object.keys(bindings ?? {}).length ? bindings : void 0
    };
    if (p.type === "SOLID" && p.boundVariables?.color)
      return { ...base, color: void 0 };
    if ("gradientStops" in p)
      return {
        ...base,
        gradientTransform: p.type === "GRADIENT_LINEAR" ? [p.gradientTransform[0]] : p.gradientTransform,
        gradientStops: p.gradientStops.map((s) => ({
          ...s,
          boundVariables: Object.keys(s.boundVariables ?? {}).length ? s.boundVariables : void 0,
          ...s.boundVariables?.color ? { color: void 0 } : {}
        }))
      };
    return base;
  }
  function samePaints(a, b) {
    return typeof a !== "symbol" && sameValue(a.map(comparablePaint), b.map(comparablePaint));
  }

  // src/core/math.ts
  var finite = (n, fallback = 0) => typeof n === "number" && Number.isFinite(n) ? n : fallback;
  var clamp = (n, min = 0, max2 = 1) => Math.max(min, Math.min(max2, n));
  function point(s) {
    if (typeof s !== "string") throw new Error("Invalid Sketch point");
    const m = s.match(/^\s*\{\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\}\s*$/);
    if (!m || !Number.isFinite(+m[1]) || !Number.isFinite(+m[2]))
      throw new Error(`Invalid Sketch point: ${s}`);
    return { x: +m[1], y: +m[2] };
  }
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
  }
  function fingerprint(value) {
    const s = typeof value === "string" ? value : stable(value);
    let a = 2166136261, b = 5381;
    for (let i2 = 0; i2 < s.length; i2++) {
      a = Math.imul(a ^ s.charCodeAt(i2), 16777619);
      b = Math.imul(b, 33) ^ s.charCodeAt(i2);
    }
    return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
  }
  function rgba(c = {}, p3 = false) {
    let r = finite(c.red), g = finite(c.green), b = finite(c.blue);
    if (p3) {
      const lin = (v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const enc = (v) => v <= 31308e-7 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
      const R = lin(r), G = lin(g), B = lin(b);
      r = enc(1.224745 * R - 0.224904 * G);
      g = enc(-0.042058 * R + 1.042081 * G);
      b = enc(-0.019642 * R - 0.078655 * G + 1.098537 * B);
    }
    return {
      r: clamp(r),
      g: clamp(g),
      b: clamp(b),
      a: clamp(finite(c.alpha, 1))
    };
  }
  function transform(s) {
    const f = s.frame ?? {};
    const w = finite(f.width), h = finite(f.height);
    const theta = -finite(s.rotation) * Math.PI / 180;
    const c = Math.cos(theta), d = Math.sin(theta), sx = s.isFlippedHorizontal ? -1 : 1, sy = s.isFlippedVertical ? -1 : 1;
    const a = c * sx, b = -d * sy, e = d * sx, g = c * sy;
    return [
      [a, b, finite(f.x) + w / 2 - a * w / 2 - b * h / 2],
      [e, g, finite(f.y) + h / 2 - e * w / 2 - g * h / 2]
    ];
  }
  function constraints(mask = 63) {
    const fixed = (bit) => (mask & bit) === 0;
    const axis = (start, end, size) => start && end ? "STRETCH" : start ? "MIN" : end ? "MAX" : size ? "CENTER" : "SCALE";
    return {
      horizontal: axis(fixed(8), fixed(1), fixed(4)),
      vertical: axis(fixed(32), fixed(2), fixed(16))
    };
  }
  function gradientTransform(g, width = 1, height = 1) {
    const a = point(g.from ?? "{0, 0.5}"), b = point(g.to ?? "{1, 0.5}");
    const dx = b.x - a.x, dy = b.y - a.y;
    const ex = -dy * height / Math.max(width, 1e-9), ey = dx * width / Math.max(height, 1e-9);
    const scale = g.gradientType === 1 ? finite(g.elipseLength, 1) : 1;
    const u = ex * scale, v = ey * scale;
    const tx = a.x - u * 0.5, ty = a.y - v * 0.5, det = dx * v - u * dy;
    if (Math.abs(det) < 1e-10) throw new Error("Degenerate gradient endpoints");
    return [
      [v / det, -u / det, (u * ty - v * tx) / det],
      [-dy / det, dx / det, (dy * tx - dx * ty) / det]
    ];
  }
  function vectorNetwork(s) {
    const pts = s.points ?? [], w = finite(s.frame?.width, 1), h = finite(s.frame?.height, 1), xy = (v) => {
      const p = point(v);
      return { x: p.x * w, y: p.y * h };
    };
    const vertices = pts.map((p) => ({
      ...xy(p.point),
      cornerRadius: (p.cornerStyle ?? 0) === 0 ? Math.max(0, finite(p.cornerRadius)) : 0,
      handleMirroring: p.curveMode === 2 ? "ANGLE_AND_LENGTH" : p.curveMode === 3 ? "ANGLE" : "NONE"
    }));
    const segments = [];
    for (let i2 = 0; i2 < (s.isClosed ? pts.length : pts.length - 1); i2++) {
      const j = (i2 + 1) % pts.length, a = vertices[i2], b = vertices[j], ca = xy(pts[i2].hasCurveFrom ? pts[i2].curveFrom : pts[i2].point), cb = xy(pts[j].hasCurveTo ? pts[j].curveTo : pts[j].point);
      segments.push({
        start: i2,
        end: j,
        tangentStart: { x: ca.x - a.x, y: ca.y - a.y },
        tangentEnd: { x: cb.x - b.x, y: cb.y - b.y }
      });
    }
    return {
      vertices,
      segments,
      regions: s.isClosed ? [
        {
          windingRule: s.style?.windingRule === 1 ? "EVENODD" : "NONZERO",
          loops: [segments.map((_, i2) => i2)]
        }
      ] : []
    };
  }

  // src/figma/storage.ts
  var CHUNK = 24e3;
  var NS = "sketch2figma";
  function writeData(node, key, value) {
    const data = JSON.stringify(value);
    const prior = Number(node.getPluginData(`${NS}:${key}:count`) || 0), count = Math.ceil(data.length / CHUNK);
    for (let i2 = 0; i2 < count; i2++)
      node.setPluginData(
        `${NS}:${key}:${i2}`,
        data.slice(i2 * CHUNK, (i2 + 1) * CHUNK)
      );
    for (let i2 = count; i2 < prior; i2++)
      node.setPluginData(`${NS}:${key}:${i2}`, "");
    node.setPluginData(`${NS}:${key}:count`, String(count));
  }
  function readData(node, key, fallback) {
    const count = Number(node.getPluginData(`${NS}:${key}:count`) || 0);
    if (!count) return fallback;
    if (!Number.isInteger(count) || count > 5e4)
      throw new Error(`Invalid metadata chunk count: ${key}`);
    let text = "";
    for (let i2 = 0; i2 < count; i2++)
      text += node.getPluginData(`${NS}:${key}:${i2}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Corrupted import metadata: ${key}`);
    }
  }
  function emptyIndex(documentId) {
    return {
      version: 1,
      documentId,
      nodes: {},
      pages: {},
      resources: {},
      assets: {},
      sourceDigest: ""
    };
  }
  function readIndex(api, id) {
    return readData(api.root, `index:${id}`, emptyIndex(id));
  }
  function writeIndex(api, index) {
    writeData(api.root, `index:${index.documentId}`, index);
  }
  var SCENE_FIELDS = [
    "name",
    "visible",
    "locked",
    "opacity",
    "blendMode",
    "relativeTransform",
    "width",
    "height",
    "constraints",
    "fills",
    "strokes",
    "strokeWeight",
    "strokeAlign",
    "strokeCap",
    "strokeJoin",
    "strokeMiterLimit",
    "dashPattern",
    "effects",
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomRightRadius",
    "bottomLeftRadius",
    "cornerSmoothing",
    "exportSettings",
    "isMask",
    "maskType",
    "clipsContent",
    "layoutMode",
    "layoutWrap",
    "itemSpacing",
    "counterAxisSpacing",
    "counterAxisAlignContent",
    "itemReverseZIndex",
    "strokesIncludedInLayout",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "layoutPositioning",
    "layoutGrow",
    "layoutAlign",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "overflowDirection",
    "numberOfFixedChildren",
    "vectorPaths",
    "vectorNetwork",
    "booleanOperation",
    "textAutoResize",
    "textAlignHorizontal",
    "textAlignVertical",
    "textTruncation",
    "paragraphSpacing",
    "paragraphIndent",
    "listSpacing",
    "characters",
    "fontName",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "fillStyleId",
    "strokeStyleId",
    "effectStyleId",
    "textStyleId",
    "reactions",
    "layoutGrids",
    "guides"
  ];
  function capture(node, recursive = false, includePlugin = true, skipObsolete = false) {
    const props = { type: node.type };
    props.variableBindings = Object.fromEntries(
      Object.entries(node.boundVariables ?? {}).filter(
        ([, v]) => v && !Array.isArray(v) && v.type === "VARIABLE_ALIAS"
      )
    );
    for (const key of SCENE_FIELDS) {
      if (key in node) {
        try {
          const value = node[key];
          if (typeof value !== "symbol" && value !== void 0)
            props[key] = JSON.parse(JSON.stringify(value));
        } catch {
        }
      }
    }
    if (node.type === "TEXT")
      props.segments = node.getStyledTextSegments([
        "fontName",
        "fontSize",
        "fills",
        "letterSpacing",
        "lineHeight",
        "textCase",
        "textDecoration",
        "textStyleId",
        "fillStyleId",
        "boundVariables",
        "listOptions",
        "paragraphIndent",
        "paragraphSpacing",
        "listSpacing"
      ]);
    const plugin = includePlugin ? Object.fromEntries(
      node.getPluginDataKeys().map((k) => [k, node.getPluginData(k)])
    ) : {};
    return {
      props,
      parentId: node.parent?.id ?? null,
      index: node.parent && "children" in node.parent ? node.parent.children.indexOf(node) : 0,
      plugin,
      ...recursive && "children" in node ? {
        children: node.children.filter(
          (c) => !skipObsolete || !c.getPluginData("sketch2figma:obsolete")
        ).map((c) => capture(c, true, includePlugin, skipObsolete))
      } : {}
    };
  }
  async function targetFingerprint(node, version = 2) {
    const snap = capture(node, true, false, true);
    const clean = (s) => ({
      props: version === 1 ? Object.fromEntries(
        Object.entries(s.props).filter(
          ([key]) => !["vectorNetwork", "booleanOperation"].includes(key)
        )
      ) : s.props,
      children: s.children?.map(clean)
    });
    const links = {};
    const visit = async (n) => {
      if (n.type === "INSTANCE")
        links[n.id] = (await n.getMainComponentAsync())?.id ?? null;
      if ("children" in n) for (const child of n.children) await visit(child);
    };
    await visit(node);
    return fingerprint({
      componentLinks: links,
      parentId: snap.parentId,
      index: snap.index,
      content: clean(snap),
      ownedAppearance: node.parent?.type === "FRAME" && node.parent.getPluginData("sketch2figma:fadeFor") === node.getPluginData("sketch2figma:sourceId") ? clean(capture(node.parent, true, false)) : void 0
    });
  }
  async function restore(api, node, snapshot) {
    const p = snapshot.props;
    if (node.type === "INSTANCE" && p.mainComponentId) {
      const master = await api.getNodeByIdAsync(p.mainComponentId);
      if (master?.type !== "COMPONENT")
        throw new Error("Recovery component unavailable");
      if ((await node.getMainComponentAsync())?.id !== master.id)
        node.swapComponent(master);
      node.removeOverrides();
    }
    if (node.type === "TEXT") {
      const fonts = (p.segments ?? []).map((s) => s.fontName);
      if (typeof node.fontName !== "symbol") fonts.push(node.fontName);
      for (const font of fonts) await api.loadFontAsync(font);
    }
    const parent = snapshot.parentId ? await api.getNodeByIdAsync(snapshot.parentId) : null;
    if (parent && parent.type !== "DOCUMENT" && "insertChild" in parent)
      parent.insertChild(Math.min(snapshot.index, parent.children.length), node);
    if ("resize" in node && p.width > 0 && p.height > 0)
      node.resize(p.width, p.height);
    if (node.type === "VECTOR" && p.vectorNetwork)
      await node.setVectorNetworkAsync(p.vectorNetwork);
    const restorationErrors = [];
    for (const [key, value] of Object.entries(p)) {
      if ([
        "type",
        "mainComponentId",
        "width",
        "height",
        "segments",
        "variableBindings",
        "vectorNetwork",
        "fillStyleId",
        "strokeStyleId",
        "effectStyleId",
        "textStyleId",
        "reactions"
      ].includes(key))
        continue;
      if (key === "vectorPaths" && node.type === "VECTOR" && p.vectorNetwork)
        continue;
      if (key in node)
        try {
          node[key] = value;
        } catch (e) {
          restorationErrors.push(`${key}: ${e}`);
        }
    }
    if ("setFillStyleIdAsync" in node)
      await node.setFillStyleIdAsync(p.fillStyleId ?? "");
    if ("setStrokeStyleIdAsync" in node)
      await node.setStrokeStyleIdAsync(p.strokeStyleId ?? "");
    if ("setEffectStyleIdAsync" in node)
      await node.setEffectStyleIdAsync(p.effectStyleId ?? "");
    if (node.type === "TEXT") await node.setTextStyleIdAsync(p.textStyleId ?? "");
    if ("setReactionsAsync" in node)
      await node.setReactionsAsync(p.reactions ?? []);
    if (node.type === "TEXT")
      for (const seg of p.segments ?? []) {
        const a = seg.start, b = seg.end;
        if (b <= a) continue;
        if (node.getRangeTextStyleId(a, b) !== seg.textStyleId)
          await node.setRangeTextStyleIdAsync(a, b, seg.textStyleId ?? "");
        if (node.getRangeFillStyleId(a, b) !== seg.fillStyleId)
          await node.setRangeFillStyleIdAsync(a, b, seg.fillStyleId ?? "");
        if (!sameFont(node.getRangeFontName(a, b), seg.fontName))
          node.setRangeFontName(a, b, seg.fontName);
        if (!sameValue(node.getRangeFontSize(a, b), seg.fontSize))
          node.setRangeFontSize(a, b, seg.fontSize);
        if (!samePaints(node.getRangeFills(a, b), seg.fills))
          node.setRangeFills(a, b, seg.fills);
        if (!sameValue(node.getRangeLetterSpacing(a, b), seg.letterSpacing))
          node.setRangeLetterSpacing(a, b, seg.letterSpacing);
        if (!sameValue(node.getRangeLineHeight(a, b), seg.lineHeight))
          node.setRangeLineHeight(a, b, seg.lineHeight);
        if (!sameValue(node.getRangeTextCase(a, b), seg.textCase))
          node.setRangeTextCase(a, b, seg.textCase);
        if (!sameValue(node.getRangeTextDecoration(a, b), seg.textDecoration))
          node.setRangeTextDecoration(a, b, seg.textDecoration);
        if (!sameValue(node.getRangeListOptions(a, b), seg.listOptions))
          node.setRangeListOptions(a, b, seg.listOptions);
        if (!sameValue(node.getRangeParagraphIndent(a, b), seg.paragraphIndent))
          node.setRangeParagraphIndent(a, b, seg.paragraphIndent);
        if (!sameValue(node.getRangeParagraphSpacing(a, b), seg.paragraphSpacing))
          node.setRangeParagraphSpacing(a, b, seg.paragraphSpacing);
        if (!sameValue(node.getRangeListSpacing(a, b), seg.listSpacing))
          node.setRangeListSpacing(a, b, seg.listSpacing);
        const fields = [
          "fontFamily",
          "fontStyle",
          "fontWeight",
          "fontSize",
          "letterSpacing",
          "lineHeight",
          "paragraphSpacing",
          "paragraphIndent"
        ];
        for (const field of fields) {
          const alias = seg.boundVariables?.[field], current = node.getRangeBoundVariable(a, b, field);
          if (alias || current) {
            const variable = alias ? await api.variables.getVariableByIdAsync(alias.id) : null;
            if (alias && !variable)
              restorationErrors.push(`Variable ${alias.id} disappeared`);
            else node.setRangeBoundVariable(a, b, field, variable);
          }
        }
      }
    for (const field of /* @__PURE__ */ new Set([
      ...Object.keys(node.boundVariables ?? {}),
      ...Object.keys(p.variableBindings ?? {})
    ])) {
      const existing = node.boundVariables?.[field], previous = p.variableBindings?.[field];
      if (existing && !Array.isArray(existing) && existing.type === "VARIABLE_ALIAS" || previous) {
        const variable = previous ? await api.variables.getVariableByIdAsync(previous.id) : null;
        if (previous && !variable)
          restorationErrors.push(`Variable ${previous.id} disappeared`);
        else node.setBoundVariable(field, variable);
      }
    }
    for (const k of node.getPluginDataKeys())
      if (!(k in snapshot.plugin)) node.setPluginData(k, "");
    for (const [k, v] of Object.entries(snapshot.plugin))
      node.setPluginData(k, v);
    if (snapshot.children && "children" in node) {
      for (const [i2, child] of snapshot.children.entries()) {
        const source = child.plugin["sketch2figma:sourceId"];
        const target = node.children.find(
          (n) => source && n.getPluginData("sketch2figma:sourceId") === source
        ) ?? node.children[i2];
        if (target)
          await restore(api, target, { ...child, parentId: node.id, index: i2 });
      }
    }
    if (restorationErrors.length) throw new Error(restorationErrors.join("; "));
  }
  var Journal = class {
    constructor(api, index) {
      this.api = api;
      this.data = {
        documentId: index.documentId,
        state: "running",
        created: [],
        resources: [],
        snapshots: {},
        resourceSnapshots: [],
        pages: {},
        previousIndex: JSON.parse(JSON.stringify(index))
      };
      this.save();
    }
    save() {
      writeData(this.api.root, "journal", this.data);
    }
    track(node) {
      this.data.created.push(node.id);
      this.save();
    }
    trackResource(resource) {
      this.data.resources.push({
        id: resource.id,
        type: "resolvedType" in resource ? "VARIABLE" : "modes" in resource ? "COLLECTION" : "STYLE"
      });
      this.save();
    }
    async before(node) {
      if (this.data.created.includes(node.id) || this.data.snapshots[node.id])
        return;
      const snapshot = capture(node, node.type === "INSTANCE");
      if (node.type === "INSTANCE")
        snapshot.props.mainComponentId = (await node.getMainComponentAsync())?.id;
      this.data.snapshots[node.id] = snapshot;
      this.save();
    }
    beforePage(page) {
      var _a2;
      if (this.data.created.includes(page.id) || this.data.pages?.[page.id])
        return;
      (_a2 = this.data).pages ?? (_a2.pages = {});
      this.data.pages[page.id] = {
        name: page.name,
        guides: page.guides,
        backgrounds: page.backgrounds,
        flowStartingPoints: page.flowStartingPoints,
        plugin: Object.fromEntries(
          page.getPluginDataKeys().map((k) => [k, page.getPluginData(k)])
        )
      };
      this.save();
    }
    beforeResource(r) {
      var _a2;
      if (this.data.resources.some((s) => s.id === r.id) || this.data.resourceSnapshots?.some((s) => s.id === r.id))
        return;
      const props = { name: r.name };
      const keys = "valuesByMode" in r ? ["valuesByMode", "scopes"] : "modes" in r ? ["modes"] : r.type === "PAINT" ? ["paints"] : r.type === "EFFECT" ? ["effects"] : r.type === "TEXT" ? [
        "fontName",
        "fontSize",
        "lineHeight",
        "letterSpacing",
        "paragraphSpacing",
        "paragraphIndent",
        "textCase",
        "textDecoration"
      ] : [];
      for (const k of keys)
        props[k] = JSON.parse(JSON.stringify(r[k]));
      (_a2 = this.data).resourceSnapshots ?? (_a2.resourceSnapshots = []);
      this.data.resourceSnapshots.push({
        id: r.id,
        type: "valuesByMode" in r ? "VARIABLE" : "modes" in r ? "COLLECTION" : "STYLE",
        props
      });
      this.save();
    }
    commit() {
      writeData(this.api.root, "journal", null);
    }
    async rollback() {
      return recover(this.api, this.data);
    }
  };
  async function recover(api, data) {
    const errors = [];
    for (const [id, s] of Object.entries(data.snapshots))
      try {
        const n = await api.getNodeByIdAsync(id), p = s.parentId ? await api.getNodeByIdAsync(s.parentId) : null;
        if (n && "visible" in n && p && p.type !== "DOCUMENT" && "insertChild" in p)
          p.insertChild(Math.min(s.index, p.children.length), n);
      } catch (e) {
        errors.push(`Relocate ${id}: ${e}`);
      }
    for (const id of [...data.created].reverse()) {
      try {
        const node = await api.getNodeByIdAsync(id);
        if (node && !node.removed) node.remove();
      } catch (e) {
        errors.push(`Remove ${id}: ${e}`);
      }
    }
    for (const [id, s] of Object.entries(data.snapshots)) {
      try {
        const node = await api.getNodeByIdAsync(id);
        if (node && "visible" in node) await restore(api, node, s);
      } catch (e) {
        errors.push(`Restore ${id}: ${e}`);
      }
    }
    for (const [id, s] of Object.entries(data.pages ?? {}))
      try {
        const p = await api.getNodeByIdAsync(id);
        if (p?.type === "PAGE") {
          p.name = s.name;
          p.guides = s.guides;
          p.backgrounds = s.backgrounds;
          p.flowStartingPoints = s.flowStartingPoints;
          for (const k of p.getPluginDataKeys())
            p.setPluginData(k, s.plugin[k] ?? "");
          for (const [k, v] of Object.entries(s.plugin)) p.setPluginData(k, v);
        }
      } catch (e) {
        errors.push(`Page ${id}: ${e}`);
      }
    for (const s of [...data.resourceSnapshots ?? []].reverse())
      try {
        const r = s.type === "VARIABLE" ? await api.variables.getVariableByIdAsync(s.id) : s.type === "COLLECTION" ? await api.variables.getVariableCollectionByIdAsync(s.id) : await api.getStyleByIdAsync(s.id);
        if (!r) throw new Error("Resource disappeared");
        r.name = s.props.name;
        if ("valuesByMode" in r) {
          r.scopes = s.props.scopes;
          for (const [mode, value] of Object.entries(s.props.valuesByMode))
            r.setValueForMode(mode, value);
        } else if ("modes" in r) {
          for (const mode of [...r.modes])
            if (!s.props.modes.some((m) => m.modeId === mode.modeId))
              r.removeMode(mode.modeId);
          for (const m of s.props.modes) r.renameMode(m.modeId, m.name);
        } else {
          if (r.type === "TEXT") await api.loadFontAsync(s.props.fontName);
          for (const [key, value] of Object.entries(s.props))
            r[key] = value;
        }
      } catch (e) {
        errors.push(`Restore resource ${s.id}: ${e}`);
      }
    for (const r of [...data.resources].reverse())
      try {
        const resource = r.type === "VARIABLE" ? await api.variables.getVariableByIdAsync(r.id) : r.type === "COLLECTION" ? await api.variables.getVariableCollectionByIdAsync(r.id) : await api.getStyleByIdAsync(r.id);
        if (resource) resource.remove();
      } catch (e) {
        errors.push(`Resource ${r.id}: ${e}`);
      }
    writeIndex(api, data.previousIndex);
    if (errors.length) {
      data.state = "recovery-needed";
      writeData(api.root, "journal", data);
    } else writeData(api.root, "journal", null);
    return errors;
  }
  async function mapping(node, s, conversionHash) {
    return {
      nodeId: node.id,
      sourceHash: fingerprint(s),
      conversionHash,
      targetHash: await targetFingerprint(node),
      targetHashVersion: 2,
      type: node.type
    };
  }

  // src/figma/report-storage.ts
  function writeReport(root, report) {
    const bytes = zlibSync(strToU8(JSON.stringify(report)));
    let data = "";
    for (const byte of bytes) data += byte.toString(16).padStart(2, "0");
    writeData(root, `audit:${report.documentId}`, {
      encoding: "zlib-hex-v1",
      data
    });
    writeData(root, "lastReport", report.documentId);
  }
  function readReport(root, documentId) {
    const stored = readData(
      root,
      `audit:${documentId}`,
      null
    );
    if (!stored) return null;
    if (stored.encoding !== "zlib-hex-v1" || !/^(?:[\da-f]{2})+$/.test(stored.data))
      throw new Error("Corrupted conversion audit.");
    try {
      const bytes = Uint8Array.from(
        stored.data.match(/../g),
        (byte) => parseInt(byte, 16)
      );
      return JSON.parse(strFromU8(unzlibSync(bytes)));
    } catch {
      throw new Error("Corrupted conversion audit.");
    }
  }
  function savedReportId(api) {
    const ids = api.root.getPluginDataKeys().flatMap((key) => {
      const match = key.match(/^sketch2figma:audit:(.+):count$/);
      return match ? [match[1]] : [];
    });
    const pageId = api.currentPage.getPluginData("sketch2figma:documentId");
    if (ids.includes(pageId)) return pageId;
    let last = null;
    try {
      last = readData(api.root, "lastReport", null);
    } catch {
    }
    return last && ids.includes(last) ? last : ids[ids.length - 1];
  }

  // src/ui/plugin-messages.ts
  function summarizeReport(report) {
    return {
      file: report.file,
      documentId: report.documentId,
      state: report.state,
      totals: report.totals,
      validations: report.validations,
      findings: report.findings,
      layers: report.layers.map(({ sourceId: sourceId2, name, targetId, sourceType }) => ({
        sourceId: sourceId2,
        name,
        targetId,
        sourceType
      }))
    };
  }

  // src/core/types.ts
  var CONVERTER_REVISION = 10;
  var DEFAULT_OPTIONS = {
    selectedIds: [],
    resources: true,
    conflict: "preserve-local",
    fontMap: {},
    componentMap: {},
    styleMap: {},
    variableMap: {},
    generatePrototypePage: false
  };
  var sourceId = (s) => String(s.do_objectID ?? s.symbolID ?? "");
  function walkLayers(pages) {
    const out = [];
    const visit = (n) => {
      out.push(n);
      for (const c of n.layers ?? []) visit(c);
    };
    for (const p of pages) visit(p);
    return out;
  }
  function ownSource(s) {
    const { layers, ...own } = s;
    return {
      ...own,
      ...layers ? { childSourceIds: layers.map(sourceId) } : {}
    };
  }

  // src/figma/tiled-images.ts
  function tiledAsset(ctx, reference) {
    return ctx.file.assets.find(
      (a) => a.tiles && (a.path === reference?._ref || a.path.startsWith(`${reference?._ref}.`))
    );
  }
  async function applyTiledBitmap(ctx, s, node) {
    const asset = tiledAsset(ctx, s.image);
    if (!asset?.tiles) {
      if ("children" in node) {
        for (const child of node.children)
          if (child.getPluginData("sketch2figma:tile") || child.getPluginData("sketch2figma:wrapper") === "bitmap-paints") {
            await ctx.journal.before(child);
            child.visible = false;
            ctx.cleanup.add(child);
          }
      }
      return false;
    }
    if (node.type !== "FRAME") {
      ctx.finding(
        "IMAGE_TILE_TARGET",
        "Oversized raster requires an editable frame with image tiles.",
        s,
        "/image",
        "error"
      );
      return false;
    }
    const image = asset.tiles, scale = Math.max(node.width / image.width, node.height / image.height), x2 = (node.width - image.width * scale) / 2, y = (node.height - image.height * scale) / 2;
    const used = /* @__PURE__ */ new Set();
    for (const [i2, tile] of image.items.entries()) {
      let rectangle = node.children.find(
        (c) => c.type === "RECTANGLE" && c.getPluginData("sketch2figma:tile") === tile.path
      );
      if (rectangle) await ctx.journal.before(rectangle);
      else {
        rectangle = ctx.api.createRectangle();
        ctx.journal.track(rectangle);
        rectangle.setPluginData("sketch2figma:tile", tile.path);
        node.appendChild(rectangle);
      }
      const bytes = ctx.file.assets.find((a) => a.path === tile.path)?.bytes;
      if (!bytes)
        throw new Error(`Missing original-resolution tile ${tile.path}`);
      let hash = ctx.index.assets[tile.path];
      if (!hash) {
        hash = ctx.api.createImage(bytes).hash;
        ctx.index.assets[tile.path] = hash;
      }
      node.insertChild(i2, rectangle);
      rectangle.name = `Image tile ${i2 + 1}`;
      const tx = x2 + tile.x * scale, ty = y + tile.y * scale;
      const tw = tile.width * scale, th = tile.height * scale;
      const left = Math.max(0, tx), top = Math.max(0, ty);
      const right = Math.min(node.width, tx + tw), bottom = Math.min(node.height, ty + th);
      const width = Math.max(0, right - left), height = Math.max(0, bottom - top);
      rectangle.fills = [
        {
          type: "IMAGE",
          imageHash: hash,
          scaleMode: "CROP",
          imageTransform: [
            [width / tw, 0, (left - tx) / tw],
            [0, height / th, (top - ty) / th]
          ]
        }
      ];
      rectangle.strokes = [];
      rectangle.resize(Math.max(0.01, width), Math.max(0.01, height));
      rectangle.x = left;
      rectangle.y = top;
      rectangle.visible = width > 0 && height > 0;
      rectangle.constraints = { horizontal: "SCALE", vertical: "SCALE" };
      used.add(rectangle);
    }
    const paints = node.fills;
    let overlay = node.children.find(
      (c) => c.getPluginData("sketch2figma:wrapper") === "bitmap-paints"
    );
    if (typeof paints !== "symbol" && paints.length) {
      if (overlay) await ctx.journal.before(overlay);
      else {
        overlay = ctx.api.createRectangle();
        ctx.journal.track(overlay);
        overlay.setPluginData("sketch2figma:wrapper", "bitmap-paints");
        node.appendChild(overlay);
      }
      node.appendChild(overlay);
      overlay.name = "Bitmap paints";
      overlay.resize(node.width, node.height);
      overlay.x = overlay.y = 0;
      overlay.fills = paints;
      overlay.strokes = [];
      overlay.visible = true;
      overlay.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
      used.add(overlay);
    }
    for (const child of node.children)
      if ((child.getPluginData("sketch2figma:tile") || child.getPluginData("sketch2figma:wrapper") === "bitmap-paints") && !used.has(child)) {
        await ctx.journal.before(child);
        child.visible = false;
        ctx.cleanup.add(child);
      }
    node.fills = [];
    node.clipsContent = false;
    writeData(node, "imageTiles", {
      source: asset.path,
      originalByteLength: asset.originalByteLength ?? asset.bytes.length,
      width: image.width,
      height: image.height,
      tiles: image.items
    });
    ctx.ledger(s).fields(
      "/image",
      ["_class", "_ref_class", "_ref"],
      "Editable Equivalent",
      "Source raster split into original-resolution native image tiles to satisfy Figma's 4096px image limit. No pixels downsampled; original asset identity and tile positions retained."
    );
    ctx.finding(
      "IMAGE_TILED",
      `${asset.path}: ${image.width}\xD7${image.height} preserved as ${image.items.length} editable native raster tiles. Browser decoding converts embedded image color profiles to sRGB; compare with the source render.`,
      s,
      "/image",
      "info"
    );
    return true;
  }

  // src/figma/appearance.ts
  var BLENDS = [
    "NORMAL",
    "DARKEN",
    "MULTIPLY",
    "COLOR_BURN",
    "LIGHTEN",
    "SCREEN",
    "COLOR_DODGE",
    "OVERLAY",
    "SOFT_LIGHT",
    "HARD_LIGHT",
    "DIFFERENCE",
    "EXCLUSION",
    "HUE",
    "SATURATION",
    "COLOR",
    "LUMINOSITY"
  ];
  function blend(value) {
    return value === 17 ? "LINEAR_DODGE" : BLENDS[value];
  }
  function colorVariable(ctx, s, color, path) {
    const id = color?.swatchID;
    if (!id) return void 0;
    const variable = ctx.resources.variables.get(id);
    if (!variable)
      ctx.finding(
        "VARIABLE_REFERENCE",
        `Unresolved source color variable ${id}.`,
        s,
        `${path}/swatchID`,
        "error"
      );
    return variable;
  }
  function solidPaint(ctx, s, color, path) {
    const c = ctx.color(color);
    let result = {
      type: "SOLID",
      color: { r: c.r, g: c.g, b: c.b },
      opacity: c.a
    };
    const variable = colorVariable(ctx, s, color, path);
    if (variable) {
      result = ctx.api.variables.setBoundVariableForPaint(
        result,
        "color",
        variable
      );
      ctx.ledger(s).mark(`${path}/swatchID`);
    }
    ctx.ledger(s).color(path);
    return result;
  }
  async function paint(ctx, s, f, path, width = 1, height = 1) {
    const l = ctx.ledger(s), base = {
      visible: f.isEnabled !== false,
      opacity: clamp(finite(f.contextSettings?.opacity, 1)),
      ...blend(f.contextSettings?.blendMode ?? 0) ? { blendMode: blend(f.contextSettings?.blendMode ?? 0) } : {}
    };
    let result = null;
    let opacityEquivalent = false;
    if (f.fillType === 0 || f.fillType === void 0) {
      const c = ctx.color(f.color);
      let p = {
        type: "SOLID",
        color: { r: c.r, g: c.g, b: c.b },
        ...base,
        opacity: base.opacity * c.a
      };
      const variable = colorVariable(ctx, s, f.color, `${path}/color`);
      if (variable) {
        p = ctx.api.variables.setBoundVariableForPaint(p, "color", variable);
        l.mark(`${path}/color/swatchID`);
      }
      if (variable && base.opacity !== 1) {
        const stop = {
          position: 0,
          color: c,
          boundVariables: {
            color: ctx.api.variables.createVariableAlias(variable)
          }
        };
        result = {
          type: "GRADIENT_LINEAR",
          gradientTransform: [
            [1, 0, 0],
            [0, 1, 0]
          ],
          gradientStops: [stop, { ...stop, position: 1 }],
          ...base
        };
        opacityEquivalent = true;
        ctx.finding(
          "BOUND_PAINT_OPACITY",
          "Bound color plus independent paint opacity represented by a constant native gradient. Both stops retain the original variable; no new resource created.",
          s,
          path,
          "info"
        );
      } else result = p;
      l.color(
        `${path}/color`,
        ctx.file.document.colorSpace === 2 ? "Partial" : "Native",
        "Color converted to destination document color profile; gamut clipping may occur."
      );
    } else if (f.fillType === 1) {
      const g = f.gradient ?? {}, types = {
        0: "GRADIENT_LINEAR",
        1: "GRADIENT_RADIAL",
        2: "GRADIENT_ANGULAR"
      };
      if (types[g.gradientType]) {
        const stops = (g.stops ?? []).map(
          (stop, i2) => {
            l.fields(`${path}/gradient/stops/${i2}`, ["_class", "position"]);
            l.color(`${path}/gradient/stops/${i2}/color`);
            let target = {
              position: clamp(finite(stop.position)),
              color: ctx.color(stop.color)
            };
            const variable = colorVariable(
              ctx,
              s,
              stop.color,
              `${path}/gradient/stops/${i2}/color`
            );
            if (variable) {
              target = {
                ...target,
                boundVariables: {
                  color: ctx.api.variables.createVariableAlias(variable)
                }
              };
              l.mark(`${path}/gradient/stops/${i2}/color/swatchID`);
            }
            return target;
          }
        );
        if (stops.length < 2)
          throw new Error("Gradient needs at least two stops.");
        result = {
          type: types[g.gradientType],
          gradientTransform: gradientTransform(g, width, height),
          gradientStops: stops,
          ...base
        };
        l.fields(
          `${path}/gradient`,
          ["_class", "gradientType", "from", "to", "elipseLength"],
          "Partial",
          "Native editable gradient; interpolation and radial aspect need visual validation."
        );
      }
    } else if (f.fillType === 4 && f.image) {
      const hash = await imageHash(ctx, f.image);
      if (hash) {
        const modes = ["TILE", "FILL", "CROP", "FIT"];
        result = {
          type: "IMAGE",
          imageHash: hash,
          scaleMode: modes[f.patternFillType ?? 1] ?? "FILL",
          ...base,
          ...f.patternFillType === 0 ? { scalingFactor: Math.max(1e-4, finite(f.patternTileScale, 1)) } : {},
          ...f.patternFillType === 2 ? {
            imageTransform: [
              [1, 0, 0],
              [0, 1, 0]
            ]
          } : {}
        };
        l.fields(`${path}/image`, ["_class", "_ref_class", "_ref"]);
        l.fields(path, ["patternFillType", "patternTileScale"]);
      }
    }
    if (result) {
      l.fields(path, ["_class", "isEnabled", "fillType"]);
      l.fields(`${path}/contextSettings`, ["_class", "opacity"]);
      if (opacityEquivalent) {
        l.mark(
          `${path}/fillType`,
          "Editable Equivalent",
          "Constant native gradient retains the source solid color-variable binding and independent paint opacity."
        );
        l.mark(
          `${path}/contextSettings/opacity`,
          "Editable Equivalent",
          "Independent gradient-paint opacity multiplies the bound variable's alpha."
        );
      }
      if (base.blendMode) l.mark(`${path}/contextSettings/blendMode`);
      else
        ctx.finding(
          "BLEND_MODE",
          `Blend mode ${f.contextSettings?.blendMode} is unsupported.`,
          s,
          `${path}/contextSettings/blendMode`
        );
    } else
      ctx.finding(
        "PAINT_UNSUPPORTED",
        `Fill type ${f.fillType} could not be converted.`,
        s,
        path
      );
    return result;
  }
  async function imageHash(ctx, ref) {
    const key = ref._ref ?? ref.sha1?._data;
    const existing = ctx.imageHashes.get(key);
    if (existing) return existing;
    let bytes = ctx.file.assets.find(
      (a) => a.path === ref._ref || a.path.startsWith(`${ref._ref}.`)
    )?.bytes;
    if (!bytes && ref.data?._data) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let acc = 0, bits2 = 0, out = [];
      for (const ch of ref.data._data) {
        if (ch === "=") break;
        const v = chars.indexOf(ch);
        if (v < 0) continue;
        acc = acc << 6 | v;
        bits2 += 6;
        if (bits2 >= 8) {
          bits2 -= 8;
          out.push(acc >> bits2 & 255);
        }
      }
      bytes = new Uint8Array(out);
    }
    if (!bytes) {
      ctx.finding("MISSING_IMAGE", `Missing embedded asset ${ref._ref}`);
      return void 0;
    }
    try {
      const hash = ctx.api.createImage(bytes).hash;
      ctx.imageHashes.set(key, hash);
      ctx.index.assets[key] = hash;
      return hash;
    } catch (e) {
      ctx.finding("IMAGE_FORMAT", `Asset ${key}: ${e}`);
      return void 0;
    }
  }
  async function effects(ctx, s, style2, base = "/style") {
    const result = [], l = ctx.ledger(s);
    for (const [key, type] of [
      ["shadows", "DROP_SHADOW"],
      ["innerShadows", "INNER_SHADOW"]
    ])
      for (const [i2, e] of (style2[key] ?? []).entries()) {
        const path = `${base}/${key}/${i2}`, b = blend(e.contextSettings?.blendMode ?? 0);
        let target = {
          type: e.isInnerShadow === true ? "INNER_SHADOW" : type,
          visible: e.isEnabled !== false,
          color: {
            ...ctx.color(e.color),
            a: ctx.color(e.color).a * clamp(finite(e.contextSettings?.opacity, 1))
          },
          offset: { x: finite(e.offsetX), y: finite(e.offsetY) },
          radius: Math.max(0, finite(e.blurRadius)),
          spread: finite(e.spread),
          blendMode: b ?? "NORMAL"
        };
        const variable = colorVariable(ctx, s, e.color, `${path}/color`);
        if (variable) {
          target = ctx.api.variables.setBoundVariableForEffect(
            target,
            "color",
            variable
          );
          l.mark(`${path}/color/swatchID`);
        }
        result.push(target);
        l.fields(path, [
          "_class",
          "isEnabled",
          "offsetX",
          "offsetY",
          "blurRadius",
          "spread",
          "isInnerShadow"
        ]);
        l.color(`${path}/color`);
        l.fields(`${path}/contextSettings`, ["_class", "opacity"]);
        if (b) l.mark(`${path}/contextSettings/blendMode`);
      }
    const glass = s.bridge?.glass;
    if (glass) {
      result.push({
        type: "GLASS",
        visible: glass.visible !== false,
        lightIntensity: clamp(finite(glass.lightIntensity, 0.5)),
        lightAngle: finite(glass.lightAngle),
        refraction: clamp(finite(glass.refraction)),
        depth: Math.max(1, finite(glass.depth, 1)),
        dispersion: clamp(finite(glass.dispersion)),
        radius: Math.max(0, finite(glass.radius))
      });
      l.fields(
        "/bridge/glass",
        [
          "visible",
          "lightIntensity",
          "lightAngle",
          "refraction",
          "depth",
          "dispersion",
          "radius"
        ],
        "Partial",
        "Native Glass effect from an explicit target-compatible sidecar definition; optical equivalence requires render validation."
      );
    }
    const blurs = style2.blurs ?? (style2.blur ? [style2.blur] : []);
    for (const [i2, blur] of blurs.entries()) {
      const path = style2.blurs ? `${base}/blurs/${i2}` : `${base}/blur`;
      if ([0, 3].includes(blur.type)) {
        result.push({
          type: blur.type === 0 ? "LAYER_BLUR" : "BACKGROUND_BLUR",
          visible: blur.isEnabled !== false,
          blurType: "NORMAL",
          radius: Math.max(0, finite(blur.radius))
        });
        l.fields(
          path,
          ["_class", "type", "radius", "isEnabled"],
          "Partial",
          "Native blur; Sketch/Figma blur kernels require pixel validation."
        );
      } else if (blur.isEnabled)
        ctx.finding(
          "UNSUPPORTED_BLUR",
          `Blur type ${blur.type} retained without rasterization.`,
          s,
          path
        );
    }
    return result;
  }
  function rebaseGradient(paint2, t) {
    if (!t || !paint2.type.startsWith("GRADIENT_")) return paint2;
    const gradient = paint2, a = gradient.gradientTransform;
    return {
      ...gradient,
      gradientTransform: [
        [
          a[0][0] * t[0][0] + a[0][1] * t[1][0],
          a[0][0] * t[0][1] + a[0][1] * t[1][1],
          a[0][0] * t[0][2] + a[0][1] * t[1][2] + a[0][2]
        ],
        [
          a[1][0] * t[0][0] + a[1][1] * t[1][0],
          a[1][0] * t[0][1] + a[1][1] * t[1][1],
          a[1][0] * t[0][2] + a[1][1] * t[1][2] + a[1][2]
        ]
      ]
    };
  }
  async function applyAppearance(ctx, s, node, paintSpace) {
    const st = s.style ?? {}, l = ctx.ledger(s);
    if ("fills" in node && (node.type !== "INSTANCE" || st.fills?.length)) {
      const checkpoint = l.checkpoint();
      const paints = [];
      for (const [i2, f] of (st.fills ?? []).entries())
        try {
          const p = await paint(
            ctx,
            s,
            f,
            `/style/fills/${i2}`,
            paintSpace?.width ?? node.width,
            paintSpace?.height ?? node.height
          );
          if (p) paints.push(p);
        } catch (e) {
          ctx.finding("FILL_FAILURE", String(e), s, `/style/fills/${i2}`);
        }
      const accepted = await ctx.attempt(s, "/style/fills", () => {
        node.fills = paints.map((p) => rebaseGradient(p, paintSpace?.transform));
      });
      if (!accepted) l.rollback(checkpoint);
    }
    if ("strokes" in node && (node.type !== "INSTANCE" || st.borders?.length)) {
      const checkpoint = l.checkpoint();
      const strokes = [], borders = st.borders ?? [];
      for (const [i2, b2] of borders.entries())
        try {
          const p = await paint(
            ctx,
            s,
            b2,
            `/style/borders/${i2}`,
            paintSpace?.width ?? node.width,
            paintSpace?.height ?? node.height
          );
          if (p) strokes.push(p);
        } catch (e) {
          ctx.finding("BORDER_FAILURE", String(e), s, `/style/borders/${i2}`);
        }
      const accepted = await ctx.attempt(s, "/style/borders", () => {
        node.strokes = strokes.map(
          (p) => rebaseGradient(p, paintSpace?.transform)
        );
      });
      if (!accepted) l.rollback(checkpoint);
      const b = borders.find((v) => v.isEnabled) || borders[0];
      if (b) {
        await ctx.attempt(
          s,
          "/style/borders/0",
          () => {
            node.strokeWeight = Math.max(0, finite(b.thickness, 1));
            node.strokeAlign = ["CENTER", "INSIDE", "OUTSIDE"][b.position ?? 0] ?? "CENTER";
          },
          []
        );
        for (const [i2, v] of borders.entries()) {
          const equal = v.thickness === b.thickness && v.position === b.position;
          l.fields(
            `/style/borders/${i2}`,
            ["thickness", "position"],
            equal ? "Native" : "Partial",
            equal ? void 0 : "Figma strokes share width and alignment; this border uses the first active border geometry."
          );
          if (!equal)
            ctx.finding(
              "MULTIPLE_BORDER_GEOMETRY",
              "Multiple Sketch borders use different widths/alignments; native Figma strokes share geometry.",
              s,
              `/style/borders/${i2}`
            );
        }
      }
      const bo = st.borderOptions;
      if (bo)
        await ctx.attempt(
          s,
          "/style/borderOptions",
          () => {
            node.dashPattern = bo.isEnabled ? bo.dashPattern ?? [] : [];
            if ("strokeCap" in node)
              node.strokeCap = ["NONE", "ROUND", "SQUARE"][bo.lineCapStyle ?? 0];
            node.strokeJoin = ["MITER", "ROUND", "BEVEL"][bo.lineJoinStyle ?? 0];
            if ("strokeMiterLimit" in node)
              node.strokeMiterLimit = Math.max(0, finite(st.miterLimit, 4));
          },
          ["_class", "isEnabled", "lineCapStyle", "lineJoinStyle"]
        );
      if (bo?.dashPattern)
        bo.dashPattern.forEach(
          (_, i2) => l.mark(`/style/borderOptions/dashPattern/${i2}`)
        );
      l.mark("/style/miterLimit");
    }
    if ("effects" in node && (node.type !== "INSTANCE" || st.shadows?.length || st.innerShadows?.length || st.blur?.isEnabled || s.bridge?.glass))
      await ctx.attempt(s, "/style/effects", async () => {
        node.effects = await effects(ctx, s, st);
      });
    if (st.contextSettings && "opacity" in node && "blendMode" in node)
      await ctx.attempt(
        s,
        "/style/contextSettings",
        () => {
          node.opacity = clamp(finite(st.contextSettings.opacity, 1));
          const b = blend(st.contextSettings.blendMode ?? 0);
          if (b) node.blendMode = b;
          else
            ctx.finding(
              "BLEND_MODE",
              `Unsupported layer blend mode ${st.contextSettings.blendMode}`,
              s,
              "/style/contextSettings/blendMode"
            );
        },
        ["_class", "opacity"]
      );
    if (st.contextSettings && "opacity" in node && "blendMode" in node && blend(st.contextSettings.blendMode ?? 0))
      l.mark("/style/contextSettings/blendMode");
    l.fields(
      "/style",
      ["_class", "do_objectID"],
      "Partial",
      "Original style identity retained as metadata; compatible bindings applied separately."
    );
    if ((s._class === "artboard" || s._class === "symbolMaster") && s.hasBackgroundColor && "fills" in node) {
      node.fills = [
        solidPaint(ctx, s, s.backgroundColor, "/backgroundColor"),
        ...typeof node.fills === "symbol" ? [] : node.fills
      ];
      l.mark("/hasBackgroundColor");
      l.color("/backgroundColor");
    }
    if (s._class === "bitmap" && s.image && "fills" in node) {
      if (await applyTiledBitmap(ctx, s, node)) return;
      const hash = await imageHash(ctx, s.image);
      if (hash) {
        node.fills = [
          { type: "IMAGE", imageHash: hash, scaleMode: "FILL" },
          ...typeof node.fills === "symbol" ? [] : node.fills
        ];
        l.fields("/image", ["_class", "_ref_class", "_ref"]);
      }
    }
  }

  // src/figma/opacity-masks.ts
  async function applyOpacityMask(ctx, source, node) {
    const settings = source.style?.contextSettings;
    if (!settings?.isProgressive) {
      ctx.ledger(source).mark("/style/contextSettings/isProgressive");
      return;
    }
    if (!settings.gradient) {
      ctx.finding(
        "FADE_GRADIENT",
        "Progressive opacity has no serialized gradient.",
        source,
        "/style/contextSettings",
        "error"
      );
      return;
    }
    const value = await paint(
      ctx,
      source,
      { fillType: 1, gradient: settings.gradient },
      "/style/contextSettings",
      node.width,
      node.height
    );
    if (!value) return;
    let wrapper = node.parent?.type === "FRAME" && node.parent.getPluginData("sketch2figma:fadeFor") === sourceId(source) ? node.parent : void 0;
    if (!wrapper) {
      const parent = node.parent;
      if (!parent || !("insertChild" in parent))
        throw new Error("Fade target has no mutable parent.");
      await ctx.journal.before(node);
      wrapper = ctx.api.createFrame();
      ctx.journal.track(wrapper);
      wrapper.name = `Opacity mask / ${source.name}`;
      wrapper.fills = [];
      wrapper.clipsContent = false;
      wrapper.resize(Math.max(0.01, node.width), Math.max(0.01, node.height));
      parent.insertChild(parent.children.indexOf(node), wrapper);
      wrapper.relativeTransform = node.relativeTransform;
      if ("constraints" in node) wrapper.constraints = node.constraints;
      wrapper.setPluginData("sketch2figma:wrapper", "opacity-mask");
      wrapper.setPluginData("sketch2figma:fadeFor", sourceId(source));
      wrapper.setPluginData("sketch2figma:documentId", ctx.file.documentId);
      if ("layoutMode" in parent && parent.layoutMode !== "NONE" && "layoutPositioning" in node) {
        wrapper.layoutPositioning = node.layoutPositioning;
        wrapper.layoutAlign = node.layoutAlign;
        wrapper.layoutSizingHorizontal = node.layoutSizingHorizontal;
        wrapper.layoutSizingVertical = node.layoutSizingVertical;
      }
      wrapper.appendChild(node);
      node.relativeTransform = [
        [1, 0, 0],
        [0, 1, 0]
      ];
      if ("constraints" in node)
        node.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
    } else await ctx.journal.before(wrapper);
    let mask = wrapper.children.find(
      (c) => c.getPluginData("sketch2figma:wrapper") === "opacity-gradient"
    );
    if (mask) await ctx.journal.before(mask);
    else {
      mask = ctx.api.createRectangle();
      ctx.journal.track(mask);
      mask.setPluginData("sketch2figma:wrapper", "opacity-gradient");
      wrapper.insertChild(0, mask);
    }
    mask.name = "Opacity gradient";
    mask.resize(Math.max(0.01, wrapper.width), Math.max(0.01, wrapper.height));
    mask.x = mask.y = 0;
    mask.fills = [value];
    mask.strokes = [];
    mask.isMask = true;
    mask.maskType = "ALPHA";
    mask.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
    ctx.ledger(source).mark(
      "/style/contextSettings/isProgressive",
      "Editable Equivalent",
      "Progressive opacity reconstructed as a native editable gradient alpha mask. Gradient interpolation requires source-render comparison."
    );
    ctx.finding(
      "FADE_ALPHA_MASK",
      "Progressive opacity converted to an editable gradient alpha mask; original raster and design layers remain editable.",
      source,
      "/style/contextSettings/isProgressive",
      "info"
    );
  }

  // src/core/audit.ts
  var escapePointer = (key) => key.replace(/~/g, "~0").replace(/\//g, "~1");
  function leaves(value, prefix = "") {
    if (value === null || typeof value !== "object") return [prefix];
    const entries = Object.entries(value);
    if (!entries.length) return [prefix];
    return entries.flatMap(
      ([key, child]) => leaves(child, `${prefix}/${escapePointer(key)}`)
    );
  }
  var Ledger = class {
    constructor(source, result) {
      this.source = source;
      this.result = result;
      this.items = /* @__PURE__ */ new Map();
      for (const path of leaves(source))
        this.items.set(path, {
          path,
          status: "Unsupported",
          reason: "Source property retained; no verified conversion handler."
        });
    }
    checkpoint() {
      return [...this.items.values()].map((p) => ({ ...p }));
    }
    rollback(items) {
      this.items = new Map(items.map((p) => [p.path, p]));
    }
    mark(path, status = "Native", reason = "Applied through the Figma Plugin API.") {
      if (this.items.has(path)) this.items.set(path, { path, status, reason });
    }
    fields(prefix, keys, status = "Native", reason) {
      for (const k of keys)
        this.mark(`${prefix}/${escapePointer(k)}`, status, reason);
    }
    color(prefix, status = "Native", reason) {
      this.fields(
        prefix,
        ["_class", "red", "green", "blue", "alpha"],
        status,
        reason
      );
    }
    finalize() {
      this.result.properties = [...this.items.values()];
      return this.result;
    }
  };
  function finishReport(report) {
    const totals = {
      Native: 0,
      "Editable Equivalent": 0,
      "Visual Equivalent": 0,
      Partial: 0,
      Unsupported: 0
    };
    for (const layer of report.layers)
      if (layer.selected) for (const p of layer.properties) totals[p.status]++;
    report.totals = totals;
    report.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    return report;
  }

  // src/core/dependencies.ts
  function masters(file) {
    const all = walkLayers(file.pages).filter((n) => n._class === "symbolMaster");
    for (const f of file.document.foreignSymbols ?? [])
      if (f.symbolMaster) all.push(f.symbolMaster);
    return new Map(all.map((s) => [String(s.symbolID), s]));
  }
  function dependencyOrder(items) {
    const ordered = [], cycles = [], missing = /* @__PURE__ */ new Set(), state = /* @__PURE__ */ new Map();
    function visit(id, chain) {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) {
        cycles.push([...chain, id]);
        return;
      }
      const s = items.get(id);
      if (!s) {
        missing.add(id);
        return;
      }
      state.set(id, 1);
      for (const n of walkLayers(s.layers ?? []))
        if (n._class === "symbolInstance")
          visit(String(n.symbolID), [...chain, id]);
      state.set(id, 2);
      ordered.push(s);
    }
    for (const id of items.keys()) visit(id, []);
    return { ordered, cycles, missing: [...missing] };
  }
  function selection(pages, ids) {
    const out = /* @__PURE__ */ new Set();
    const selected = new Set(ids);
    const all = ids.length === 0;
    function visit(n, inherited) {
      const yes = all || inherited || selected.has(sourceId(n));
      let any = yes;
      for (const c of n.layers ?? []) any = visit(c, yes) || any;
      if (any) out.add(sourceId(n));
      return any;
    }
    for (const p of pages) visit(p, false);
    return out;
  }
  function requiredSymbols(pages, scope, available) {
    const result = /* @__PURE__ */ new Set();
    function add(id) {
      if (result.has(id)) return;
      result.add(id);
      const s = available.get(id);
      if (s) {
        for (const n of walkLayers(s.layers ?? []))
          if (n._class === "symbolInstance") {
            add(String(n.symbolID));
            for (const o of n.overrideValues ?? []) if (String(o.overrideName).endsWith("_symbolID") && o.value) add(String(o.value));
          }
      }
    }
    for (const n of walkLayers(pages))
      if (scope.has(sourceId(n)) && n._class === "symbolInstance") {
        add(String(n.symbolID));
        for (const o of n.overrideValues ?? []) if (String(o.overrideName).endsWith("_symbolID") && o.value) add(String(o.value));
      }
    return result;
  }

  // src/core/resource-selection.ts
  var includeUnused = (options, kind) => options.resourceTypes?.[kind] ?? options.resources;
  function sourceStyles(file, kind) {
    const foreign = kind === "layerStyles" ? "foreignLayerStyles" : "foreignTextStyles";
    const local = kind === "layerStyles" ? "layerStyles" : "layerTextStyles";
    return [
      ...file.document[local]?.objects ?? [],
      ...(file.document[foreign] ?? []).map((s) => s.localSharedStyle).filter(Boolean)
    ];
  }
  function resourceSelection(file, options) {
    const scope = options.resourcesOnly ? /* @__PURE__ */ new Set() : selection(file.pages, options.selectedIds);
    for (const group of walkLayers(file.pages))
      if (group._class === "shapeGroup" && scope.has(sourceId(group)))
        for (const child of walkLayers(group.layers ?? []))
          scope.add(sourceId(child));
    const available = masters(file), ordinary = new Set(scope);
    for (const master of available.values())
      for (const layer of walkLayers([master])) ordinary.delete(sourceId(layer));
    const symbols = requiredSymbols(file.pages, ordinary, available);
    const selected = new Set(options.selectedIds);
    for (const [id, master] of available)
      if (includeUnused(options, "components") || selected.has(id) || selected.has(sourceId(master))) {
        symbols.add(id);
        for (const child of requiredSymbols(
          [master],
          new Set(walkLayers([master]).map(sourceId)),
          available
        ))
          symbols.add(child);
      }
    if (options.resourceTypes?.components === false) {
      for (const [id, master] of available)
        if (!symbols.has(id))
          for (const layer of walkLayers([master])) scope.delete(sourceId(layer));
    }
    const byId = new Map(
      walkLayers(file.pages).filter((n) => scope.has(sourceId(n))).map((n) => [sourceId(n), n])
    );
    for (const id of symbols) {
      const master = available.get(id);
      if (master)
        for (const layer of walkLayers([master]))
          byId.set(sourceId(layer), layer);
    }
    const styles = /* @__PURE__ */ new Set(), colors = /* @__PURE__ */ new Set();
    function references(value) {
      if (!value || typeof value !== "object") return;
      const object = value;
      if (typeof object.sharedStyleID === "string")
        styles.add(object.sharedStyleID);
      if (typeof object.swatchID === "string") colors.add(object.swatchID);
      if (/_(textStyle|layerStyle)$/.test(String(object.overrideName)) && typeof object.value === "string")
        styles.add(object.value);
      for (const [key, child] of Object.entries(object))
        if (key !== "layers" && key !== "userInfo") references(child);
    }
    for (const layer of byId.values()) references(layer);
    const definitions = [
      ...sourceStyles(file, "layerStyles"),
      ...sourceStyles(file, "textStyles")
    ];
    for (const kind of ["layerStyles", "textStyles"])
      if (includeUnused(options, kind))
        for (const style2 of sourceStyles(file, kind)) styles.add(sourceId(style2));
    const scanned = /* @__PURE__ */ new Set();
    for (const id of styles) {
      if (scanned.has(id)) continue;
      scanned.add(id);
      const definition = definitions.find((s) => sourceId(s) === id);
      if (definition) references(definition.value);
    }
    const tokenNames = /* @__PURE__ */ new Set(), tokens = options.tokens;
    const requireToken = (name) => {
      if (tokenNames.has(name)) return;
      tokenNames.add(name);
      const token = tokens?.tokens.find((t) => t.name === name);
      for (const value of Object.values(token?.values ?? {}))
        if (typeof value === "string" && /^\{.+\}$/.test(value))
          requireToken(value.slice(1, -1));
    };
    if (tokens) {
      if (includeUnused(options, "tokens"))
        for (const token of tokens.tokens) requireToken(token.name);
      for (const binding of tokens.bindings ?? [])
        if (byId.has(binding.sourceId)) requireToken(binding.token);
    }
    return {
      scope,
      symbols,
      layers: [...byId.values()],
      styles,
      colors,
      tokenNames
    };
  }

  // src/figma/context.ts
  var ImportContext = class {
    constructor(api, file, options, report, index, journal, progress) {
      this.api = api;
      this.file = file;
      this.options = options;
      this.report = report;
      this.index = index;
      this.journal = journal;
      this.progress = progress;
      this.resources = {
        paints: /* @__PURE__ */ new Map(),
        strokes: /* @__PURE__ */ new Map(),
        effects: /* @__PURE__ */ new Map(),
        texts: /* @__PURE__ */ new Map(),
        variables: /* @__PURE__ */ new Map(),
        components: /* @__PURE__ */ new Map()
      };
      this.nodes = /* @__PURE__ */ new Map();
      this.ledgers = /* @__PURE__ */ new Map();
      this.fonts = [];
      this.imageHashes = /* @__PURE__ */ new Map();
      this.processed = /* @__PURE__ */ new Set();
      this.cancelled = false;
      this.cleanup = /* @__PURE__ */ new Set();
      this.conversionHash = fingerprint({
        revision: CONVERTER_REVISION,
        fontMap: options.fontMap,
        fallbackFont: options.fallbackFont,
        componentMap: options.componentMap,
        styleMap: options.styleMap,
        variableMap: options.variableMap,
        resourceTypes: options.resourceTypes,
        sourceColorSpace: file.document.colorSpace,
        targetColorProfile: api.root.documentColorProfile
      });
    }
    ledger(s, selected = true) {
      const id = sourceId(s);
      let l = this.ledgers.get(id);
      if (!l) {
        l = new Ledger(ownSource(s), {
          sourceId: id,
          name: s.name ?? s._class ?? id,
          sourceType: s._class ?? "document",
          selected,
          properties: []
        });
        this.ledgers.set(id, l);
      }
      return l;
    }
    finding(code, message, s, path, severity = "warning", resource) {
      this.report.findings.push({
        code,
        message,
        sourceId: s ? sourceId(s) : void 0,
        path,
        severity,
        ...resource ? { resource } : s?._class === "sharedStyle" ? {
          resource: s.value?.textStyle ? "textStyles" : "layerStyles"
        } : {}
      });
    }
    async attempt(s, path, fn, keys = [], status = "Native", reason) {
      const checkpoint = this.ledger(s).checkpoint();
      try {
        await fn();
        if (keys.length) this.ledger(s).fields(path, keys, status, reason);
        else this.ledger(s).mark(path, status, reason);
        return true;
      } catch (e) {
        this.ledger(s).rollback(checkpoint);
        this.finding("API_REJECTED", `${String(e)}`, s, path, "error");
        return false;
      }
    }
    color(c) {
      const sourceP3 = this.file.document.colorSpace === 2;
      const targetP3 = this.api.root.documentColorProfile === "DISPLAY_P3";
      if (sourceP3 && !targetP3) return rgba(c, true);
      if (!sourceP3 && targetP3) {
        const v = rgba(c), lin = (x2) => x2 <= 0.04045 ? x2 / 12.92 : ((x2 + 0.055) / 1.055) ** 2.4, enc = (x2) => x2 <= 31308e-7 ? 12.92 * x2 : 1.055 * Math.max(x2, 0) ** (1 / 2.4) - 0.055, R = lin(v.r), G = lin(v.g), B = lin(v.b);
        return {
          r: enc(0.82259287 * R + 0.17753395 * G),
          g: enc(0.03319951 * R + 0.9667835 * G),
          b: enc(0.01708535 * R + 0.07239572 * G + 0.91030148 * B),
          a: v.a
        };
      }
      return rgba(c);
    }
    async tick(s) {
      if (this.cancelled) throw new Error("IMPORT_CANCELLED");
      this.progress(this.processed.size, s.name ?? s._class);
      await new Promise((r) => setTimeout(r, 0));
      if (this.cancelled) throw new Error("IMPORT_CANCELLED");
    }
    finish() {
      this.report.layers = [...this.ledgers.values()].map((l) => l.finalize());
    }
  };

  // src/figma/geometry.ts
  function createNode(ctx, s) {
    const api = ctx.api;
    switch (s._class) {
      case "symbolMaster":
        return api.createComponent();
      case "text":
        return api.createText();
      case "rectangle":
        if (!s.edited) return api.createRectangle();
        return api.createVector();
      case "oval":
        if (!s.edited) return api.createEllipse();
        return api.createVector();
      case "bitmap":
        if (tiledAsset(ctx, s.image)) {
          const frame = api.createFrame();
          frame.fills = [];
          frame.clipsContent = false;
          return frame;
        }
        return api.createRectangle();
      case "slice":
        return api.createSlice();
      case "shapePath":
      case "polygon":
      case "star":
      case "triangle":
        return api.createVector();
      default: {
        const n = api.createFrame();
        n.fills = [];
        n.clipsContent = s._class === "artboard" || s.clipsContents === true;
        return n;
      }
    }
  }
  async function applyGeometry(ctx, s, node) {
    const l = ctx.ledger(s), f = s.frame ?? {};
    await ctx.attempt(
      s,
      "/frame",
      () => {
        if ("resize" in node)
          node.resize(
            Math.max(0.01, finite(f.width, 1)),
            Math.max(0.01, finite(f.height, 1))
          );
      },
      ["_class", "width", "height"],
      f.width === 0 || f.height === 0 ? "Partial" : "Native",
      "Zero dimensions are clamped to 0.01 where Figma requires positive bounds."
    );
    const transformed = await ctx.attempt(s, "/transform", () => {
      node.relativeTransform = transform(s);
    });
    if (transformed) {
      l.fields("/frame", ["x", "y"]);
      l.fields("", ["rotation", "isFlippedHorizontal", "isFlippedVertical"]);
    }
    if ("clipsContent" in node && s.clippingBehavior !== void 0) {
      node.clipsContent = s.clippingBehavior === 1 || s.clippingBehavior === 0 && (s.groupBehavior === 1 || s._class === "symbolMaster");
      l.mark("/clippingBehavior");
    }
    if ("constraints" in node && s.hasExplicitConstraints && s.horizontalPins !== void 0) {
      const axis = (pins, sizing) => pins === 5 ? "STRETCH" : pins & 1 ? "MIN" : pins & 4 ? "MAX" : sizing === 3 ? "SCALE" : "CENTER";
      node.constraints = {
        horizontal: axis(s.horizontalPins, s.horizontalSizing),
        vertical: axis(s.verticalPins, s.verticalSizing)
      };
      l.fields("", ["horizontalPins", "verticalPins", "hasExplicitConstraints"]);
    } else if ("constraints" in node)
      await ctx.attempt(s, "/resizingConstraint", () => {
        node.constraints = constraints(s.resizingConstraint);
      });
    if ("constrainProportions" in node && f.constrainProportions !== void 0)
      await ctx.attempt(s, "/frame/constrainProportions", () => {
        node.constrainProportions = f.constrainProportions;
      });
    await ctx.attempt(s, "/name", () => {
      node.name = s.name ?? s._class;
    });
    if (s.isVisible !== void 0)
      await ctx.attempt(s, "/isVisible", () => {
        node.visible = !!s.isVisible;
      });
    if (s.isLocked !== void 0)
      await ctx.attempt(s, "/isLocked", () => {
        node.locked = !!s.isLocked;
      });
    l.mark(
      "/do_objectID",
      "Native",
      "Source identity persisted in plugin metadata."
    );
    const nativeTypes = {
      symbolMaster: "COMPONENT",
      symbolInstance: "INSTANCE",
      text: "TEXT",
      rectangle: "RECTANGLE",
      oval: "ELLIPSE",
      slice: "SLICE",
      artboard: "FRAME",
      group: "GROUP",
      shapeGroup: "BOOLEAN_OPERATION",
      shapePath: "VECTOR"
    };
    const recognized = [
      ...Object.keys(nativeTypes),
      "bitmap",
      "polygon",
      "star",
      "triangle",
      "frame",
      "graphic"
    ].includes(s._class);
    if (recognized)
      l.mark(
        "/_class",
        nativeTypes[s._class] === node.type ? "Native" : "Editable Equivalent",
        "Editable target type recorded independently of visual fidelity."
      );
    else
      ctx.finding(
        "LAYER_TYPE",
        `Unsupported source layer type ${s._class}; editable bounds placeholder and original metadata retained.`,
        s,
        "/_class",
        "error"
      );
    if (node.type === "VECTOR" && s.points?.length) {
      const ok = await ctx.attempt(s, "/points", async () => {
        await node.setVectorNetworkAsync(vectorNetwork(s));
      });
      if (ok) {
        for (const [i2, p] of s.points.entries()) {
          l.fields(`/points/${i2}`, [
            "_class",
            "point",
            "curveFrom",
            "curveTo",
            "hasCurveFrom",
            "hasCurveTo",
            "curveMode"
          ]);
          if ((p.cornerStyle ?? 0) === 0)
            l.fields(`/points/${i2}`, ["cornerRadius", "cornerStyle"]);
          else
            ctx.finding(
              "VECTOR_CORNER",
              "Non-round vector corner style retained; native vector corner radius cannot reproduce it.",
              s,
              `/points/${i2}/cornerStyle`
            );
        }
        l.mark("/isClosed");
        l.mark("/style/windingRule");
      }
    }
    if (node.type === "RECTANGLE" && s.points?.length === 4) {
      const radii = s.points.map(
        (p) => Math.max(0, finite(p.cornerRadius))
      );
      if (s.points.every((p) => (p.cornerStyle ?? 0) === 0)) {
        node.topLeftRadius = radii[0];
        node.topRightRadius = radii[1];
        node.bottomRightRadius = radii[2];
        node.bottomLeftRadius = radii[3];
        s.points.forEach(
          (_, i2) => l.fields(`/points/${i2}`, ["cornerRadius", "cornerStyle"])
        );
      } else
        ctx.finding(
          "CORNER_STYLE",
          "Non-round rectangle corner styles retained; native rectangle cannot reproduce them.",
          s,
          "/points"
        );
    }
    const corners = s.style?.corners;
    if (corners && "topLeftRadius" in node && corners.radii?.length) {
      if (corners.style === 0 || corners.style === 1) {
        const radii = corners.radii;
        node.topLeftRadius = radii[0];
        node.topRightRadius = radii[1 % radii.length];
        node.bottomRightRadius = radii[2 % radii.length];
        node.bottomLeftRadius = radii[3 % radii.length];
        if ("cornerSmoothing" in node)
          node.cornerSmoothing = corners.style === 1 ? finite(corners.smoothing) : 0;
        l.fields(
          "/style/corners",
          ["_class", "style"],
          corners.style === 1 ? "Partial" : "Native",
          corners.style === 1 ? "Native smoothing may use a different curve." : void 0
        );
        radii.forEach(
          (_, i2) => l.mark(`/style/corners/radii/${i2}`)
        );
        if (corners.smoothing !== void 0)
          l.mark(
            "/style/corners/smoothing",
            corners.style === 1 ? "Partial" : "Native"
          );
        if (corners.prefersConcentric)
          ctx.finding(
            "CONCENTRIC_CORNERS",
            "Concentric corner behavior has no live native equivalent; serialized radii retained.",
            s,
            "/style/corners/prefersConcentric"
          );
        else l.mark("/style/corners/prefersConcentric");
      } else
        ctx.finding(
          "CORNER_STYLE",
          `Corner style ${corners.style} has no native radius equivalent.`,
          s,
          "/style/corners/style"
        );
    }
    if ("exportSettings" in node) {
      const checkpoint = l.checkpoint();
      const settings = [];
      for (const [i2, e] of (s.exportOptions?.exportFormats ?? []).entries()) {
        const path = `/exportOptions/exportFormats/${i2}`, format = String(e.fileFormat).toUpperCase();
        if (["PNG", "JPG"].includes(format)) {
          settings.push({
            format,
            suffix: e.namingScheme === 0 ? e.name ?? "" : "",
            constraint: {
              type: e.visibleScaleType === 1 ? "WIDTH" : e.visibleScaleType === 2 ? "HEIGHT" : "SCALE",
              value: e.visibleScaleType ? Math.max(0.01, finite(e.absoluteSize, 1)) : Math.max(0.01, finite(e.scale, 1))
            }
          });
        } else if (format === "SVG")
          settings.push({
            format: "SVG",
            suffix: e.namingScheme === 0 ? e.name ?? "" : ""
          });
        else if (format === "PDF")
          settings.push({
            format: "PDF",
            suffix: e.namingScheme === 0 ? e.name ?? "" : ""
          });
        else {
          ctx.finding(
            "EXPORT_FORMAT",
            `Unsupported export format ${format}.`,
            s,
            path
          );
          continue;
        }
        l.fields(path, [
          "_class",
          "fileFormat",
          "scale",
          "absoluteSize",
          "visibleScaleType"
        ]);
        l.fields(
          path,
          ["name", "namingScheme"],
          e.namingScheme && e.name ? "Partial" : "Native",
          "Figma export settings support suffixes; Sketch prefixes remain source metadata."
        );
      }
      const accepted = await ctx.attempt(
        s,
        "/exportOptions/exportFormats",
        () => {
          node.exportSettings = settings;
        }
      );
      if (!accepted) l.rollback(checkpoint);
    }
  }

  // src/figma/text-style-values.ts
  var textRangeFields = [
    "fontName",
    "fontSize",
    "letterSpacing",
    "lineHeight",
    "textCase",
    "textDecoration",
    "paragraphIndent",
    "paragraphSpacing",
    "listSpacing",
    "textWrapStyle"
  ];
  var textNodeFields = [
    "leadingTrim",
    "hangingPunctuation",
    "hangingList"
  ];
  var textVariableFields = [
    "fontFamily",
    "fontStyle",
    "fontWeight",
    "fontSize",
    "letterSpacing",
    "lineHeight",
    "paragraphIndent",
    "paragraphSpacing"
  ];
  function textStyleValues(style2) {
    return Object.fromEntries([
      ...[...textRangeFields, ...textNodeFields].map((key) => [key, style2[key]]),
      [
        "boundVariables",
        Object.fromEntries(
          textVariableFields.filter((field) => style2.boundVariables?.[field]).map((field) => [field, style2.boundVariables[field]])
        )
      ]
    ]);
  }
  function textRangeValues(node, range) {
    return Object.fromEntries([
      ...textRangeFields.map((key) => [key, range[key]]),
      ...textNodeFields.map((key) => [key, node[key]]),
      [
        "boundVariables",
        Object.fromEntries(
          textVariableFields.filter((field) => range.boundVariables?.[field]).map((field) => [field, range.boundVariables[field]])
        )
      ]
    ]);
  }
  function textStyleDifferences(a, b) {
    const differences = [];
    for (const field of [...textRangeFields, ...textNodeFields])
      if (!(field === "fontName" ? sameFont(a.fontName, b.fontName) : sameValue(a[field], b[field])))
        differences.push(field);
    for (const field of textVariableFields)
      if (!sameValue(a.boundVariables?.[field], b.boundVariables?.[field]))
        differences.push(`boundVariables.${field}`);
    return differences;
  }
  function textRanges(node) {
    return node.getStyledTextSegments([
      ...textRangeFields,
      "boundVariables",
      "textStyleId",
      "fillStyleId",
      "fills"
    ]);
  }
  function rangeMatches(node, start, end, expected) {
    if (!node.characters.length)
      return textStyleDifferences(textStyleValues(node), expected).length === 0;
    const ranges = textRanges(node).filter(
      (range) => range.start < end && range.end > start
    );
    return ranges.length > 0 && ranges.every(
      (range) => textStyleDifferences(textRangeValues(node, range), expected).length === 0
    );
  }
  async function restoreTextRange(ctx, node, start, end, values) {
    await ctx.api.loadFontAsync(values.fontName);
    const methods = node;
    for (const field of textRangeFields) {
      const suffix = field[0].toUpperCase() + field.slice(1);
      const current = node.characters.length ? methods[`getRange${suffix}`].call(node, start, end) : node[field];
      const equal = field === "fontName" ? sameFont(current, values.fontName) : sameValue(current, values[field]);
      if (!equal) {
        if (node.characters.length)
          methods[`setRange${suffix}`].call(node, start, end, values[field]);
        else node[field] = values[field];
      }
    }
    for (const field of textNodeFields)
      if (!sameValue(node[field], values[field]))
        node[field] = values[field];
    for (const field of textVariableFields) {
      const alias = values.boundVariables?.[field];
      if (sameValue(
        (node.characters.length ? node.getRangeBoundVariable(start, end, field) : node.boundVariables?.[field]) ?? void 0,
        alias
      ))
        continue;
      const variable = alias ? await ctx.api.variables.getVariableByIdAsync(alias.id) : null;
      if (alias && !variable)
        throw new Error(`Missing typography variable ${alias.id}.`);
      if (node.characters.length)
        node.setRangeBoundVariable(start, end, field, variable);
      else node.setBoundVariable(field, variable);
    }
  }

  // src/figma/text-style-bindings.ts
  async function isTextStyleBound(ctx, sourceStyleId, node) {
    const original = ctx.resources.texts.get(sourceStyleId);
    if (!original) return false;
    return node.characters.length ? textRanges(node).every((range) => range.textStyleId === original.id) : node.textStyleId === original.id;
  }
  async function bindOriginal(ctx, node, start, end, style2, values) {
    await ctx.api.loadFontAsync(style2.fontName);
    await ctx.api.loadFontAsync(values.fontName);
    try {
      if (node.characters.length)
        await node.setRangeTextStyleIdAsync(start, end, style2.id);
      else await node.setTextStyleIdAsync(style2.id);
      await restoreTextRange(ctx, node, start, end, values);
      if ((node.characters.length ? node.getRangeTextStyleId(start, end) : node.textStyleId) === style2.id && rangeMatches(node, start, end, values))
        return true;
    } catch {
    }
    await restoreTextRange(ctx, node, start, end, values);
    if (!rangeMatches(node, start, end, values))
      throw new Error(
        `Could not restore exact typography after binding ${style2.name}.`
      );
    return false;
  }
  async function reconcileTextStyleBindings(ctx, source, node, instanceOwner) {
    const auditSource = instanceOwner ?? source;
    const auditPath = instanceOwner ? "/symbolID" : "/sharedStyleID";
    const attempt = async (fn) => {
      if (!instanceOwner) return ctx.attempt(source, auditPath, fn);
      try {
        await fn();
      } catch (error) {
        ctx.finding(
          "API_REJECTED",
          `${node.name} (${node.id}): ${String(error)}`,
          auditSource,
          auditPath,
          "error"
        );
      }
    };
    const sourceStyleId = source.sharedStyleID;
    if (!sourceStyleId) return;
    const style2 = ctx.resources.texts.get(sourceStyleId);
    if (!style2) {
      ctx.finding(
        "TEXT_STYLE_REFERENCE",
        `${source.name}: source Text Style ${sourceStyleId} could not be resolved.`,
        auditSource,
        auditPath,
        "error"
      );
      return;
    }
    const rangePath = `${auditPath}/${instanceOwner ? node.id + "/" : ""}ranges/`;
    ctx.report.findings = ctx.report.findings.filter(
      (f) => !(f.code === "TEXT_STYLE_OVERRIDE" && f.sourceId === sourceId(auditSource) && f.path?.startsWith(rangePath))
    );
    const segments = node.characters.length ? textRanges(node).map((range) => ({
      start: range.start,
      end: range.end,
      textStyleId: range.textStyleId,
      values: textRangeValues(node, range)
    })) : [
      {
        start: 0,
        end: 0,
        textStyleId: node.textStyleId,
        values: textStyleValues(node)
      }
    ];
    for (const segment of segments) {
      if (segment.textStyleId === style2.id) continue;
      const values = segment.values;
      const differences = textStyleDifferences(values, textStyleValues(style2));
      await attempt(async () => {
        if (await bindOriginal(ctx, node, segment.start, segment.end, style2, values))
          return;
        const path = `${rangePath}${segment.start}:${segment.end}`;
        if (!ctx.report.findings.some(
          (f) => f.code === "TEXT_STYLE_OVERRIDE" && f.sourceId === sourceId(auditSource) && f.path === path
        ))
          ctx.finding(
            "TEXT_STYLE_OVERRIDE",
            `${source.name}: ${node.characters.length ? `range ${segment.start}\u2013${segment.end}` : "empty text"} cannot retain ${style2.name} with its source overrides (${differences.join(", ") || "host rejected binding"}). Exact typography retained without creating a style.`,
            auditSource,
            path
          );
      });
    }
    if (!instanceOwner) {
      const bound = await isTextStyleBound(ctx, sourceStyleId, node);
      ctx.ledger(source).mark(
        "/sharedStyleID",
        bound ? "Native" : "Partial",
        bound ? "All ranges retain the original source Text Style." : "Incompatible source overrides retain exact values; original style relationship retained in metadata. No additional styles created."
      );
    }
  }

  // src/figma/typography.ts
  var normalizeFont = (name) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  var postscriptAliases = {
    ArialMT: { family: "Arial", style: "Regular" },
    "Arial-BoldMT": { family: "Arial", style: "Bold" },
    "Arial-ItalicMT": { family: "Arial", style: "Italic" },
    "Arial-BoldItalicMT": { family: "Arial", style: "Bold Italic" }
  };
  function matchFont(name, fonts) {
    const alias = postscriptAliases[name];
    if (alias)
      return fonts.find(
        (f) => normalizeFont(f.fontName.family + f.fontName.style) === normalizeFont(alias.family + alias.style)
      )?.fontName;
    const n = normalizeFont(name);
    return fonts.find((f) => normalizeFont(f.fontName.family + f.fontName.style) === n)?.fontName ?? fonts.find(
      (f) => normalizeFont(f.fontName.family) === n && f.fontName.style === "Regular"
    )?.fontName;
  }
  async function resolveFont(ctx, descriptor, s, path) {
    const name = descriptor?.attributes?.name ?? "Inter-Regular", replacement = ctx.options.fontMap[name];
    let font = replacement ?? matchFont(name, ctx.fonts);
    let replaced = !!replacement;
    if (!font) {
      font = ctx.options.fallbackFont;
      replaced = true;
      if (!font)
        throw new Error(
          `Missing font ${name}. Choose a replacement before import.`
        );
    }
    const variations = descriptor?.attributes?.variation;
    if (variations) {
      const axes = ctx.api.getFontFamilyVariationAxes(font.family), settings = {};
      for (const [key, value] of Object.entries(variations)) {
        const n = Number(key), tag = Number.isFinite(n) ? String.fromCharCode(
          n >>> 24 & 255,
          n >>> 16 & 255,
          n >>> 8 & 255,
          n & 255
        ) : key;
        if (axes?.includes(tag) && typeof value === "number") {
          settings[tag] = value;
          ctx.ledger(s).mark(`${path}/attributes/variation/${key}`);
        } else
          ctx.finding(
            "FONT_AXIS",
            `Variable font axis ${tag} is unavailable in ${font.family}.`,
            s,
            `${path}/attributes/variation/${key}`
          );
      }
      font = {
        ...font,
        ...Object.keys(settings).length ? { variationSettings: settings } : {}
      };
    }
    await ctx.api.loadFontAsync(font);
    ctx.ledger(s).fields(path, ["_class"], replaced ? "Partial" : "Native");
    ctx.ledger(s).mark(
      `${path}/attributes/name`,
      replaced ? "Partial" : "Native",
      replaced ? `Replaced ${name} with ${font.family} ${font.style}.` : "Matched available Figma font."
    );
    if (replaced)
      ctx.finding(
        "FONT_REPLACED",
        `${name} \u2192 ${font.family} ${font.style}`,
        s,
        path
      );
    return font;
  }
  function rangeValue(node, getter, setter, a, b, value) {
    const target = node;
    const before = target[getter]?.(a, b);
    const same = getter === "getRangeFontName" ? sameFont(before, value) : sameValue(before, value);
    if (!target[getter] || !same) {
      target[setter](a, b, value);
    }
  }
  async function applyRange(ctx, s, node, attrs, a, b, path) {
    const l = ctx.ledger(s);
    if (b <= a) return;
    const font = attrs.MSAttributedStringFontAttribute;
    if (font) {
      rangeValue(
        node,
        "getRangeFontName",
        "setRangeFontName",
        a,
        b,
        await resolveFont(
          ctx,
          font,
          s,
          `${path}/MSAttributedStringFontAttribute`
        )
      );
      if (typeof font.attributes?.size === "number") {
        rangeValue(
          node,
          "getRangeFontSize",
          "setRangeFontSize",
          a,
          b,
          Math.max(1, font.attributes.size)
        );
        l.mark(`${path}/MSAttributedStringFontAttribute/attributes/size`);
      }
    }
    const color = attrs.MSAttributedStringColorAttribute;
    if (color) {
      const baseColor = s.style?.textStyle?.encodedAttributes?.MSAttributedStringColorAttribute;
      if (!(s.style?.fills ?? []).some((f) => f.isEnabled !== false) || JSON.stringify(color) !== JSON.stringify(baseColor)) {
        const fills = [
          solidPaint(ctx, s, color, `${path}/MSAttributedStringColorAttribute`)
        ];
        if (!samePaints(node.getRangeFills(a, b), fills))
          node.setRangeFills(a, b, fills);
      } else
        l.color(
          `${path}/MSAttributedStringColorAttribute`,
          "Partial",
          "Attributed fallback color retained; active text fills define appearance."
        );
    }
    if (typeof attrs.kerning === "number") {
      rangeValue(node, "getRangeLetterSpacing", "setRangeLetterSpacing", a, b, {
        unit: "PIXELS",
        value: attrs.kerning
      });
      l.mark(
        `${path}/kerning`,
        "Partial",
        "Editable letter spacing; Sketch pair kerning and font shaping may differ."
      );
    }
    const underline = attrs.underlineStyle === 1, strike = attrs.strikethroughStyle === 1;
    if (underline || strike || attrs.underlineStyle === 0 || attrs.strikethroughStyle === 0) {
      if ("setRangeTextDecoration" in node)
        rangeValue(
          node,
          "getRangeTextDecoration",
          "setRangeTextDecoration",
          a,
          b,
          underline ? "UNDERLINE" : strike ? "STRIKETHROUGH" : "NONE"
        );
      l.fields(
        path,
        ["underlineStyle", "strikethroughStyle"],
        underline && strike ? "Partial" : "Native",
        underline && strike ? "Figma supports one textDecoration; underline retained, strikethrough metadata preserved." : void 0
      );
    }
    if (attrs.MSAttributedStringTextTransformAttribute !== void 0) {
      rangeValue(
        node,
        "getRangeTextCase",
        "setRangeTextCase",
        a,
        b,
        ["ORIGINAL", "UPPER", "LOWER"][attrs.MSAttributedStringTextTransformAttribute] ?? "ORIGINAL"
      );
      l.mark(`${path}/MSAttributedStringTextTransformAttribute`);
    }
    if ("textAlignHorizontal" in node && attrs.paragraphStyle) {
      const p = attrs.paragraphStyle, base = `${path}/paragraphStyle`;
      if (p.alignment !== void 0) {
        node.textAlignHorizontal = ["LEFT", "RIGHT", "CENTER", "JUSTIFIED", "LEFT"][p.alignment] ?? "LEFT";
        l.mark(
          `${base}/alignment`,
          p.alignment === 4 ? "Partial" : "Native",
          "Paragraph alignment applies to the text box; Natural alignment depends on writing direction."
        );
      }
      const line = p.maximumLineHeight ?? p.minimumLineHeight;
      if (line > 0 && "setRangeLineHeight" in node) {
        rangeValue(node, "getRangeLineHeight", "setRangeLineHeight", a, b, {
          unit: "PIXELS",
          value: line
        });
        l.fields(
          base,
          ["minimumLineHeight", "maximumLineHeight"],
          "Partial",
          "One native line height; distinct minimum and maximum are retained in metadata."
        );
      } else if ("setRangeLineHeight" in node)
        rangeValue(node, "getRangeLineHeight", "setRangeLineHeight", a, b, {
          unit: "AUTO"
        });
      if (node.type === "TEXT") {
        if (p.paragraphSpacing !== void 0) {
          rangeValue(
            node,
            "getRangeParagraphSpacing",
            "setRangeParagraphSpacing",
            a,
            b,
            p.paragraphSpacing
          );
          l.mark(`${base}/paragraphSpacing`);
        }
        if (p.firstLineHeadIndent !== void 0) {
          rangeValue(
            node,
            "getRangeParagraphIndent",
            "setRangeParagraphIndent",
            a,
            b,
            p.firstLineHeadIndent
          );
          l.mark(
            `${base}/firstLineHeadIndent`,
            "Partial",
            "Figma paragraph indent; precise head/tail indentation remains metadata."
          );
        }
      }
      l.mark(`${base}/_class`);
    }
  }
  async function applyText(ctx, s, node, bindBaseStyle) {
    const l = ctx.ledger(s), text = s.attributedString?.string ?? "", base = s.style?.textStyle?.encodedAttributes ?? {}, descriptor = base.MSAttributedStringFontAttribute ?? s.attributedString?.attributes?.[0]?.attributes?.MSAttributedStringFontAttribute;
    await loadCurrentFonts(ctx, node);
    await bindBaseStyle?.();
    const sourceStyle = node.type === "TEXT" && ctx.resources.texts.get(s.sharedStyleID);
    if (!sourceStyle) {
      const font = await resolveFont(
        ctx,
        descriptor,
        s,
        "/style/textStyle/encodedAttributes/MSAttributedStringFontAttribute"
      );
      if (!sameFont(node.fontName, font)) node.fontName = font;
    }
    if (node.characters !== text) node.characters = text;
    l.fields("/attributedString", ["_class", "string"]);
    await applyRange(
      ctx,
      s,
      node,
      base,
      0,
      text.length,
      "/style/textStyle/encodedAttributes"
    );
    for (const [i2, r] of (s.attributedString?.attributes ?? []).entries()) {
      const a = r.location, b = a + r.length, path = `/attributedString/attributes/${i2}`;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > text.length || b < a) {
        ctx.finding(
          "TEXT_RANGE",
          "Invalid UTF-16 rich text range.",
          s,
          path,
          "error"
        );
        continue;
      }
      await applyRange(
        ctx,
        s,
        node,
        r.attributes ?? {},
        a,
        b,
        `${path}/attributes`
      );
      l.fields(path, ["_class", "location", "length"]);
    }
    node.textAlignVertical = ["TOP", "CENTER", "BOTTOM"][s.style?.textStyle?.verticalAlignment ?? 0] ?? "TOP";
    l.fields("/style/textStyle", ["_class", "verticalAlignment"]);
    if (node.type === "TEXT") {
      const w = Math.max(0.01, finite(s.frame?.width, 1)), h = Math.max(0.01, finite(s.frame?.height, 1));
      node.textAutoResize = "NONE";
      node.resize(w, h);
      node.textAutoResize = ["WIDTH_AND_HEIGHT", "HEIGHT", "NONE"][s.textBehaviour ?? (s.horizontalSizing === 1 ? 0 : s.verticalSizing === 1 ? 1 : 2)] ?? "NONE";
      l.mark(
        "/textBehaviour",
        "Partial",
        "Native text sizing; glyph metrics and line breaks require source-render comparison."
      );
    }
    if (node.type === "TEXT") await reconcileTextStyleBindings(ctx, s, node);
    node.name = s.name ?? text;
  }
  function currentFontNames(node) {
    if (node.characters.length)
      return node.getRangeAllFontNames(0, node.characters.length);
    return typeof node.fontName === "symbol" ? [] : [node.fontName];
  }
  async function loadCurrentFonts(ctx, node) {
    for (const font of currentFontNames(node)) await ctx.api.loadFontAsync(font);
    if (node.characters.length && typeof node.fontName !== "symbol")
      await ctx.api.loadFontAsync(node.fontName);
  }

  // src/figma/serialized-layout.ts
  var cyclicFit = (s, key) => s[key] === 1 && (s.layers ?? []).some(
    (child) => !child.flexItem?.ignoreLayout && child[key] === 2
  );
  var primaryAlignments = [
    "MIN",
    "CENTER",
    "MAX",
    "SPACE_BETWEEN",
    "SPACE_AROUND",
    "SPACE_EVENLY"
  ];
  var isStack = (s) => s.groupLayout?._class === "MSImmutableFlexGroupLayout";
  async function applySerializedStack(ctx, s, node) {
    if (!isStack(s) || !("layoutMode" in node) || node.type === "INSTANCE")
      return false;
    const g = s.groupLayout, l = ctx.ledger(s), horizontal = g.flexDirection === 0;
    if (![0, 1].includes(g.flexDirection)) {
      ctx.finding(
        "STACK_DIRECTION",
        `Unknown Stack direction ${g.flexDirection}.`,
        s,
        "/groupLayout/flexDirection",
        "error"
      );
      return true;
    }
    const accepted = await ctx.attempt(
      s,
      "/groupLayout",
      () => {
        node.layoutMode = horizontal ? "HORIZONTAL" : "VERTICAL";
        node.layoutWrap = g.wrappingEnabled ? "WRAP" : "NO_WRAP";
        node.primaryAxisSizingMode = "FIXED";
        node.counterAxisSizingMode = "FIXED";
        node.primaryAxisAlignItems = primaryAlignments[g.justifyContent] ?? "MIN";
        node.counterAxisAlignItems = ["MIN", "CENTER", "MAX"][g.alignItems] ?? "MIN";
        node.counterAxisAlignContent = g.alignContent === 3 ? "SPACE_BETWEEN" : "AUTO";
        node.itemSpacing = finite(g.allGuttersGap);
        if (g.wrappingEnabled)
          node.counterAxisSpacing = finite(g.crossAxisGutterGap);
        node.paddingLeft = finite(s.leftPadding);
        node.paddingRight = finite(s.rightPadding);
        node.paddingTop = finite(s.topPadding);
        node.paddingBottom = finite(s.bottomPadding);
        node.itemReverseZIndex = g.stackingOrder !== 1;
        if (typeof g.bordersAffectLayout === "boolean")
          node.strokesIncludedInLayout = g.bordersAffectLayout;
        const children = [...node.children].reverse();
        children.forEach((child, i2) => node.insertChild(i2, child));
        node.resize(
          Math.max(0.01, finite(s.frame?.width, 1)),
          Math.max(0.01, finite(s.frame?.height, 1))
        );
      },
      [
        "_class",
        "flexDirection",
        "wrappingEnabled",
        "allGuttersGap",
        "crossAxisGutterGap"
      ]
    );
    if (!accepted) return true;
    l.fields("", [
      "leftPadding",
      "rightPadding",
      "topPadding",
      "bottomPadding",
      "paddingSelection"
    ]);
    if (Number.isInteger(g.justifyContent) && primaryAlignments[g.justifyContent])
      l.mark("/groupLayout/justifyContent");
    else
      ctx.finding(
        "STACK_DISTRIBUTION",
        `Unrecognized Sketch distribution ${g.justifyContent}. Original positions and distribution retained in metadata.`,
        s,
        "/groupLayout/justifyContent"
      );
    if ([0, 1, 2, 3].includes(g.alignItems)) l.mark("/groupLayout/alignItems");
    else
      ctx.finding(
        "STACK_ALIGNMENT",
        `Unknown Stack alignment ${g.alignItems}.`,
        s,
        "/groupLayout/alignItems"
      );
    if ([0, 1].includes(g.stackingOrder)) l.mark("/groupLayout/stackingOrder");
    else if (g.stackingOrder !== void 0)
      ctx.finding(
        "STACK_ORDER",
        `Unknown Stack stacking order ${g.stackingOrder}.`,
        s,
        "/groupLayout/stackingOrder"
      );
    if (typeof g.bordersAffectLayout === "boolean")
      l.mark(
        "/groupLayout/bordersAffectLayout",
        g.bordersAffectLayout ? "Partial" : "Native",
        g.bordersAffectLayout ? "Figma border-box layout enabled. Sketch measures protruding child borders; the two layout models require native visual verification." : "Stroke-inclusive layout disabled as in the source."
      );
    if ([0, 3].includes(g.alignContent)) l.mark("/groupLayout/alignContent");
    else
      ctx.finding(
        "STACK_ALIGN_CONTENT",
        `Wrapped line distribution ${g.alignContent} has no native Figma equivalent.`,
        s,
        "/groupLayout/alignContent"
      );
    l.mark(
      "/_class",
      "Editable Equivalent",
      "Sketch container converted to native Auto Layout. Flow order reversed from source back-to-front stacking; first-on-top preserves overlap order."
    );
    for (const child of s.layers ?? []) {
      const target = ctx.nodes.get(String(child.do_objectID));
      if (target) await applySerializedItem(ctx, child, target, s);
    }
    const primary = horizontal ? s.horizontalSizing : s.verticalSizing, cross = horizontal ? s.verticalSizing : s.horizontalSizing;
    const primaryKey = horizontal ? "horizontalSizing" : "verticalSizing", crossKey = horizontal ? "verticalSizing" : "horizontalSizing";
    node.primaryAxisSizingMode = primary === 1 && !cyclicFit(s, primaryKey) ? "AUTO" : "FIXED";
    node.counterAxisSizingMode = cross === 1 && !cyclicFit(s, crossKey) ? "AUTO" : "FIXED";
    for (const key of [primaryKey, crossKey])
      if (cyclicFit(s, key)) {
        l.mark(
          `/${key}`,
          "Partial",
          "Content-based parent with Fill children forms a sizing cycle in Figma. Source parent dimension retained as fixed; child Fill and text wrapping remain editable."
        );
        ctx.finding(
          "CYCLIC_LAYOUT",
          "Source Fit container has Fill children on the same axis. Preserved its source dimension to prevent intrinsic-width expansion.",
          s,
          `/${key}`
        );
      }
    for (const key of ["horizontalSizing", "verticalSizing"])
      if ([0, 1].includes(s[key]) && !cyclicFit(s, key)) l.mark(`/${key}`);
    return true;
  }
  async function applySerializedItem(ctx, s, node, parentSource) {
    const parent = node.parent;
    if (!parent || !("layoutMode" in parent) || parent.layoutMode === "NONE" || !("layoutPositioning" in node))
      return;
    const l = ctx.ledger(s), item = s.flexItem;
    for (const [key, width, height] of [
      ["minSize", "minWidth", "minHeight"],
      ["maxSize", "maxWidth", "maxHeight"]
    ])
      if (s[key] !== void 0 && width in node && height in node)
        await ctx.attempt(s, `/${key}`, () => {
          const size = point(s[key]);
          if (size.x < 0 || size.y < 0) throw new Error(`Invalid Sketch ${key}`);
          node[width] = size.x || null;
          node[height] = size.y || null;
        });
    if (item) {
      node.layoutPositioning = item.ignoreLayout ? "ABSOLUTE" : "AUTO";
      node.layoutAlign = ["MIN", "CENTER", "MAX", "STRETCH"][item.alignSelf] ?? (parentSource?.groupLayout.alignItems === 3 ? "STRETCH" : node.layoutAlign === "STRETCH" ? "STRETCH" : "INHERIT");
      if (item.ignoreLayout) node.relativeTransform = transform(s);
      l.fields("/flexItem", ["_class", "alignSelf", "ignoreLayout"]);
      if (!item.preserveSpaceWhenHidden)
        l.mark("/flexItem/preserveSpaceWhenHidden");
      else
        ctx.finding(
          "HIDDEN_LAYOUT_SPACE",
          "Figma hidden children do not reserve Stack space. Source setting retained.",
          s,
          "/flexItem/preserveSpaceWhenHidden"
        );
    }
    if ("resize" in node && (s.horizontalSizing === 0 || s.verticalSizing === 0 || cyclicFit(s, "horizontalSizing") || cyclicFit(s, "verticalSizing")))
      node.resize(
        s.horizontalSizing === 0 || cyclicFit(s, "horizontalSizing") ? Math.max(0.01, finite(s.frame?.width, 1)) : node.width,
        s.verticalSizing === 0 || cyclicFit(s, "verticalSizing") ? Math.max(0.01, finite(s.frame?.height, 1)) : node.height
      );
    for (const [key, field] of [
      ["horizontalSizing", "layoutSizingHorizontal"],
      ["verticalSizing", "layoutSizingVertical"]
    ]) {
      if (s[key] === void 0) continue;
      let sizing = s[key] === 1 ? "HUG" : s[key] === 2 ? "FILL" : "FIXED";
      if (cyclicFit(s, key)) sizing = "FIXED";
      let reason = cyclicFit(s, key) ? "Fit/Fill cycle represented by the fixed source parent dimension with live child Fill sizing." : s[key] === 3 ? "Relative percentage sizing has no direct native equivalent; source dimension retained." : void 0;
      if (item?.ignoreLayout && sizing === "FILL") {
        sizing = "FIXED";
        reason = "Absolute child Fill sizing cannot participate in Figma Auto Layout; source dimension retained.";
      }
      if (sizing === "HUG" && node.type !== "TEXT" && (!("layoutMode" in node) || node.layoutMode === "NONE")) {
        sizing = "FIXED";
        reason = "Freeform content-based sizing has no native Auto Layout hug equivalent; source dimension retained.";
      }
      await ctx.attempt(
        s,
        `/${key}`,
        () => {
          node[field] = sizing;
        },
        [],
        reason ? "Partial" : "Native",
        reason
      );
    }
    if (parentSource?.groupLayout.alignItems === 3 && item?.alignSelf === 5)
      node.layoutAlign = "STRETCH";
  }

  // src/figma/layout.ts
  async function applyGuidesGrids(ctx, s, node) {
    const l = ctx.ledger(s);
    if ("guides" in node) {
      const checkpoint = l.checkpoint();
      const guides = [];
      for (const [key, axis] of [
        ["horizontalRulerData", "Y"],
        ["verticalRulerData", "X"]
      ]) {
        const r = s[key];
        for (const [i2, offset] of (r?.guides ?? []).entries()) {
          guides.push({ axis, offset: finite(offset) + finite(r.base) });
          l.mark(`/${key}/guides/${i2}`);
        }
        if (r) l.fields(`/${key}`, ["_class", "base"]);
      }
      const accepted = await ctx.attempt(s, "/guides", () => {
        node.guides = guides;
      });
      if (!accepted) l.rollback(checkpoint);
    }
    if ("layoutGrids" in node) {
      const checkpoint = l.checkpoint();
      const grids = [], g = s.grid, layout = s.layout, color = { r: 1, g: 0, b: 0, a: 0.1 };
      if (g) {
        grids.push({
          pattern: "GRID",
          sectionSize: Math.max(1, finite(g.gridSize, 8)),
          visible: g.isEnabled !== false,
          color
        });
        l.fields("/grid", ["_class", "gridSize", "isEnabled"]);
      }
      if (layout) {
        if (layout.drawVertical !== false)
          grids.push({
            pattern: "COLUMNS",
            alignment: "MIN",
            gutterSize: Math.max(0, finite(layout.gutterWidth)),
            count: Math.max(1, finite(layout.numberOfColumns, 1)),
            sectionSize: Math.max(1, finite(layout.columnWidth, 1)),
            offset: finite(layout.horizontalOffset),
            visible: layout.isEnabled !== false,
            color
          });
        if (layout.drawHorizontal)
          grids.push({
            pattern: "ROWS",
            alignment: "MIN",
            gutterSize: Math.max(0, finite(layout.gutterHeight)),
            count: Infinity,
            sectionSize: Math.max(1, finite(layout.rowHeightMultiplication, 1)),
            offset: 0,
            visible: layout.isEnabled !== false,
            color
          });
        l.fields("/layout", [
          "_class",
          "isEnabled",
          "drawVertical",
          "numberOfColumns",
          "columnWidth",
          "gutterWidth",
          "horizontalOffset"
        ]);
        if (layout.drawHorizontal)
          l.fields(
            "/layout",
            ["drawHorizontal", "gutterHeight", "rowHeightMultiplication"],
            "Partial",
            "Sketch horizontal-grid multiplier approximated as native row size."
          );
      }
      const accepted = await ctx.attempt(s, "/layoutGrids", () => {
        node.layoutGrids = grids;
      });
      if (!accepted) l.rollback(checkpoint);
    }
  }
  async function applyLayout(ctx, s, node) {
    if (!("layoutMode" in node) || node.type === "INSTANCE") return;
    if (await applySerializedStack(ctx, s, node)) return;
    const gl = s.groupLayout, l = ctx.ledger(s);
    if (gl?._class === "MSImmutableInferredGroupLayout") {
      const horizontal = gl.axis === 0, children = (s.layers ?? []).filter((n) => n.isVisible !== false), axis = horizontal ? "x" : "y", size = horizontal ? "width" : "height";
      const sorted = [...children].sort((a, b) => a.frame[axis] - b.frame[axis]);
      const gaps = sorted.slice(1).map(
        (n, i2) => n.frame[axis] - sorted[i2].frame[axis] - sorted[i2].frame[size]
      );
      const gap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const start = sorted[0]?.frame[axis] ?? 0;
      const far = Math.max(
        0,
        ...children.map((c) => c.frame[axis] + c.frame[size])
      );
      await ctx.attempt(
        s,
        "/groupLayout",
        () => {
          node.layoutMode = horizontal ? "HORIZONTAL" : "VERTICAL";
          node.primaryAxisSizingMode = "FIXED";
          node.counterAxisSizingMode = "FIXED";
          node.itemSpacing = gap;
          node.primaryAxisAlignItems = ["MIN", "CENTER", "MAX"][gl.layoutAnchor ?? 0] ?? "MIN";
          node.counterAxisAlignItems = "MIN";
          if (horizontal) {
            node.paddingLeft = Math.max(0, start);
            node.paddingRight = Math.max(0, node.width - far);
          } else {
            node.paddingTop = Math.max(0, start);
            node.paddingBottom = Math.max(0, node.height - far);
          }
        },
        ["_class", "axis", "layoutAnchor"],
        "Partial",
        "Legacy Smart Layout translated to measured Auto Layout. Sketch resizing semantics and nonuniform gaps may differ."
      );
      ctx.finding(
        "SMART_LAYOUT_APPROXIMATION",
        "Legacy Smart Layout uses measured Auto Layout; validate responsive behavior.",
        s,
        "/groupLayout"
      );
    }
    const stack = s.bridge?.stackLayout;
    if (stack) {
      const path = "/bridge/stackLayout";
      const dir = stack.direction === "Row" ? "HORIZONTAL" : stack.direction === "Column" ? "VERTICAL" : null;
      if (!dir) {
        ctx.finding(
          "STACK_DIRECTION",
          "Unrecognized sidecar Stack direction.",
          s,
          path
        );
        return;
      }
      await ctx.attempt(
        s,
        path,
        () => {
          node.layoutMode = dir;
          node.layoutWrap = stack.wraps ? "WRAP" : "NO_WRAP";
          node.primaryAxisSizingMode = "FIXED";
          node.counterAxisSizingMode = "FIXED";
          node.itemSpacing = finite(stack.gap);
          if (stack.wraps) node.counterAxisSpacing = finite(stack.crossAxisGap);
          const aligns = {
            Start: "MIN",
            Center: "CENTER",
            End: "MAX",
            Between: "SPACE_BETWEEN",
            Around: "SPACE_AROUND",
            Evenly: "SPACE_EVENLY"
          };
          node.primaryAxisAlignItems = aligns[stack.justifyContent] ?? "MIN";
          node.counterAxisAlignItems = stack.alignItems === "Center" ? "CENTER" : stack.alignItems === "End" ? "MAX" : "MIN";
          const p = stack.padding ?? 0;
          node.paddingTop = typeof p === "number" ? p : finite(p.top, finite(p.vertical));
          node.paddingBottom = typeof p === "number" ? p : finite(p.bottom, finite(p.vertical));
          node.paddingLeft = typeof p === "number" ? p : finite(p.left, finite(p.horizontal));
          node.paddingRight = typeof p === "number" ? p : finite(p.right, finite(p.horizontal));
          node.itemReverseZIndex = stack.stackingOrder === "FirstOnTop";
          node.strokesIncludedInLayout = !!stack.bordersAffectLayout;
        },
        [
          "direction",
          "wraps",
          "gap",
          "crossAxisGap",
          "alignItems",
          "stackingOrder",
          "bordersAffectLayout"
        ],
        "Partial",
        "Versioned Sketch DOM sidecar mapped to Auto Layout; validate against current Sketch renders."
      );
      if (!["Start", "Center", "End", "Between", "Around", "Evenly"].includes(
        stack.justifyContent
      ))
        ctx.finding(
          "STACK_DISTRIBUTION",
          `Unrecognized sidecar distribution ${stack.justifyContent}; original value retained in metadata.`,
          s,
          `${path}/justifyContent`
        );
      else l.mark(`${path}/justifyContent`);
      if (typeof stack.padding === "number") l.mark(`${path}/padding`);
      else
        l.fields(`${path}/padding`, [
          "top",
          "bottom",
          "left",
          "right",
          "horizontal",
          "vertical"
        ]);
    }
  }
  async function applyChildLayout(ctx, s, node) {
    if (!node.parent || !("layoutMode" in node.parent) || node.parent.layoutMode === "NONE" || !("layoutPositioning" in node))
      return;
    if (s.flexItem || s.horizontalSizing !== void 0)
      await applySerializedItem(ctx, s, node);
    const b = s.bridge;
    if (!b) return;
    const l = ctx.ledger(s);
    if (b.ignoresStackLayout) {
      node.layoutPositioning = "ABSOLUTE";
      l.mark("/bridge/ignoresStackLayout");
    } else node.layoutPositioning = "AUTO";
    const sizing = (value) => value === "Fill" ? "FILL" : value === "Fit" ? "HUG" : "FIXED";
    for (const [key, field] of [
      ["horizontalSizing", "layoutSizingHorizontal"],
      ["verticalSizing", "layoutSizingVertical"]
    ])
      if (b[key])
        await ctx.attempt(
          s,
          `/bridge/${key}`,
          () => {
            node[field] = sizing(b[key]);
          },
          [],
          b[key] === "Relative" ? "Partial" : "Native",
          b[key] === "Relative" ? "Percentage sizing retained; fixed source dimension used." : void 0
        );
    for (const [key, prefix] of [
      ["minSize", "min"],
      ["maxSize", "max"]
    ])
      for (const dim of ["width", "height"])
        if (b[key]?.[dim] !== void 0) {
          const field = `${prefix}${dim === "width" ? "Width" : "Height"}`;
          await ctx.attempt(s, `/bridge/${key}/${dim}`, () => {
            node[field] = b[key][dim];
          });
        }
    if (b.preservesSpaceInStackLayoutWhenHidden && s.isVisible === false)
      ctx.finding(
        "HIDDEN_LAYOUT_SPACE",
        "Figma hidden children do not reserve Stack space; source setting retained.",
        s,
        "/bridge/preservesSpaceInStackLayoutWhenHidden"
      );
  }

  // src/figma/resources.ts
  var styleSnapshot = (s) => s.type === "PAINT" ? { name: s.name, paints: s.paints } : s.type === "EFFECT" ? { name: s.name, effects: s.effects } : s.type === "TEXT" ? {
    name: s.name,
    fontName: s.fontName,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    paragraphSpacing: s.paragraphSpacing,
    paragraphIndent: s.paragraphIndent,
    textCase: s.textCase,
    textDecoration: s.textDecoration
  } : s.type === "GRID" ? { name: s.name, layoutGrids: s.layoutGrids } : { name: s.name, type: s.type };
  function remember(ctx, key, source, target) {
    var _a2;
    ctx.index.resources[key] = target.id;
    (_a2 = ctx.index).resourceStates ?? (_a2.resourceStates = {});
    ctx.index.resourceStates[key] = {
      sourceHash: fingerprint(source),
      conversionHash: ctx.conversionHash,
      targetHash: fingerprint(
        "resolvedType" in target ? { name: target.name, valuesByMode: target.valuesByMode } : styleSnapshot(target)
      )
    };
  }
  async function style(ctx, key, type, name, source, apply) {
    const mapped = ctx.options.styleMap[key], id = mapped ?? ctx.index.resources[key];
    let resource = id ? id.startsWith("key:") ? await ctx.api.importStyleByKeyAsync(id.slice(4)) : await ctx.api.getStyleByIdAsync(id) : null;
    if (mapped && !resource)
      throw new Error(`Explicit style mapping ${key} was not found: ${mapped}`);
    if (resource && resource.type !== type) {
      ctx.finding(
        "STYLE_TYPE",
        `Mapped style ${key} is ${resource.type}; expected ${type}.`,
        source,
        key,
        "warning",
        type === "TEXT" ? "textStyles" : "layerStyles"
      );
      if (mapped)
        throw new Error(
          `Explicit style mapping ${key} has incompatible type ${resource.type}; expected ${type}.`
        );
      resource = null;
    }
    if (mapped && resource) {
      ctx.finding(
        "STYLE_MAPPING",
        `Using explicitly mapped existing style ${name}.`,
        void 0,
        key,
        "info"
      );
      ctx.index.resources[key] = resource.id;
      return resource;
    }
    if (resource) {
      const record = ctx.index.resourceStates?.[key];
      const targetUnchanged = record && fingerprint(styleSnapshot(resource)) === record.targetHash;
      const legacySuffix = key.startsWith("effect:") ? " / Effects" : void 0;
      if (legacySuffix && resource.name === `${name}${legacySuffix}`) {
        ctx.journal.beforeResource?.(resource);
        resource.name = name;
        if (record && targetUnchanged)
          record.targetHash = fingerprint(styleSnapshot(resource));
      }
      if (record?.sourceHash === fingerprint(source) && record.conversionHash === ctx.conversionHash && (targetUnchanged || ctx.options.conflict === "preserve-local")) {
        const audit = ctx.index.resourceAudits?.[sourceId(source)];
        if (audit)
          for (const p of audit.properties)
            ctx.ledger(source).mark(p.path, p.status, p.reason);
        return resource;
      }
      if (!record || fingerprint(styleSnapshot(resource)) !== record.targetHash) {
        if (ctx.options.conflict === "preserve-local") {
          ctx.finding(
            "RESOURCE_CONFLICT",
            `Local edits to style ${name} preserved.`,
            source,
            key,
            "warning",
            type === "TEXT" ? "textStyles" : "layerStyles"
          );
          return resource;
        }
      }
      ctx.journal.beforeResource?.(resource);
    } else {
      resource = type === "EFFECT" ? ctx.api.createEffectStyle() : ctx.api.createTextStyle();
      ctx.journal.trackResource(resource);
    }
    const ledger = ctx.ledger(source), checkpoint = ledger.checkpoint();
    try {
      resource.name = name;
      await apply(resource);
    } catch (error) {
      ledger.rollback(checkpoint);
      throw error;
    }
    remember(ctx, key, source, resource);
    return resource;
  }
  async function importResources(ctx) {
    var _a2;
    const doc = ctx.file.document;
    const selected = (source, kind, required) => {
      if (includeUnused(ctx.options, kind) || !required || required.has(sourceId(source)))
        return true;
      const ledger = ctx.ledger(source, false);
      for (const property of ledger.finalize().properties)
        ledger.mark(
          property.path,
          "Unsupported",
          "Unused source resource excluded by import options; original definition retained in document metadata."
        );
      return false;
    };
    const d = {
      ...doc,
      do_objectID: `${ctx.file.documentId}:document`,
      _class: "document",
      name: ctx.file.name
    };
    ctx.ledger(d);
    const swatches = [
      ...doc.sharedSwatches?.objects ?? [],
      ...(doc.foreignSwatches ?? []).map((v) => v.localSwatch ?? v.swatch).filter(Boolean)
    ].filter(
      (sw) => selected(sw, "colors", ctx.resourceSelection?.colors)
    );
    let collection = null;
    const cid = ctx.index.resources["color-collection"];
    if (cid)
      collection = await ctx.api.variables.getVariableCollectionByIdAsync(cid);
    if (swatches.length && !collection) {
      collection = ctx.api.variables.createVariableCollection(ctx.file.name);
      ctx.journal.trackResource(collection);
      ctx.index.resources["color-collection"] = collection.id;
    }
    if (collection && collection.name === `${ctx.file.name.replace(/\.sketch$/i, "")} / Colors`) {
      ctx.journal.beforeResource?.(collection);
      collection.name = ctx.file.name;
    }
    const colorScopes = [
      "FRAME_FILL",
      "SHAPE_FILL",
      "TEXT_FILL",
      "STROKE_COLOR",
      "EFFECT_COLOR"
    ];
    const indexedColors = new Set(
      Object.entries(ctx.index.resources).filter(([key]) => key.startsWith("color:")).map(([, id]) => id)
    );
    let collectionVariables;
    for (const sw of swatches) {
      const id = sourceId(sw), l = ctx.ledger(sw);
      try {
        const mapped = ctx.options.variableMap[id], priorId = mapped ?? ctx.index.resources[`color:${id}`];
        let v = priorId ? priorId.startsWith("key:") ? await ctx.api.variables.importVariableByKeyAsync(priorId.slice(4)) : await ctx.api.variables.getVariableByIdAsync(priorId) : null;
        if (mapped && !v)
          throw new Error(
            `Explicit variable mapping ${id} was not found: ${mapped}`
          );
        if (v && v.resolvedType !== "COLOR")
          throw new Error("Mapped variable is not COLOR.");
        if (!v && !mapped && priorId && collection && ctx.index.resourceStates?.[`color:${id}`]) {
          collectionVariables ?? (collectionVariables = await Promise.all(
            collection.variableIds.map(
              (id2) => ctx.api.variables.getVariableByIdAsync(id2)
            )
          ));
          const candidates = collectionVariables.filter(
            (candidate) => !!candidate && !indexedColors.has(candidate.id) && candidate.resolvedType === "COLOR" && candidate.name === (sw.name ?? id) && candidate.scopes.length === colorScopes.length && colorScopes.every((scope) => candidate.scopes.includes(scope))
          );
          if (candidates.length && swatches.filter(
            (source) => (source.name ?? sourceId(source)) === (sw.name ?? id)
          ).length !== 1)
            throw new Error(
              `Cannot identify the replacement color variable for duplicate Sketch name ${sw.name}.`
            );
          if (candidates.length > 1)
            throw new Error(
              `Multiple replacement color variables match ${sw.name}; the source mapping is ambiguous.`
            );
          v = candidates[0] ?? null;
        }
        if (!v && collection) {
          v = ctx.api.variables.createVariable(
            sw.name ?? id,
            collection,
            "COLOR"
          );
          v.scopes = colorScopes;
          ctx.journal.trackResource(v);
        }
        if (!v || !collection) continue;
        if (!mapped) {
          const key = `color:${id}`;
          ctx.journal.beforeResource?.(v);
          v.name = sw.name ?? id;
          const c = ctx.color(sw.value ?? sw.color);
          v.setValueForMode(collection.defaultModeId, c);
          const actual = v.valuesByMode[collection.defaultModeId];
          if (!actual || typeof actual !== "object" || !("r" in actual) || !["r", "g", "b", "a"].every((channel) => {
            const value = channel === "a" && !("a" in actual) ? 1 : actual[channel];
            return Number.isFinite(value) && Math.abs(value - c[channel]) <= 1e-6;
          }))
            throw new Error(
              `Color variable ${v.name} does not match Sketch after assignment.`
            );
          remember(ctx, key, sw, v);
          indexedColors.add(v.id);
        }
        ctx.resources.variables.set(id, v);
        ctx.index.resources[`color:${id}`] = v.id;
        l.fields("", ["_class", "do_objectID", "name"]);
        l.color(sw.value ? "/value" : "/color");
      } catch (e) {
        ctx.finding("VARIABLE_FAILURE", String(e), sw, "", "error");
      }
    }
    for (const shared of [
      ...doc.layerStyles?.objects ?? [],
      ...(doc.foreignLayerStyles ?? []).map((s) => s.localSharedStyle).filter(Boolean)
    ]) {
      if (!selected(shared, "layerStyles", ctx.resourceSelection?.styles))
        continue;
      const id = sourceId(shared), st = shared.value ?? {}, l = ctx.ledger(shared);
      try {
        for (const [field, target] of [
          ["fills", ctx.resources.paints],
          ["borders", ctx.resources.strokes]
        ]) {
          if (st[field] === void 0) continue;
          const paints = [];
          for (const [i2, fill] of st[field].entries()) {
            const converted = await paint(
              ctx,
              shared,
              fill,
              `/value/${field}/${i2}`
            );
            if (converted) paints.push(converted);
          }
          target.set(id, paints);
        }
        if (st.shadows?.length || st.innerShadows?.length || st.blur || st.blurs?.length) {
          const e = await style(
            ctx,
            `effect:${id}`,
            "EFFECT",
            shared.name,
            shared,
            async (r) => {
              r.effects = await effects(
                ctx,
                shared,
                st,
                "/value"
              );
            }
          );
          ctx.resources.effects.set(id, e);
        }
        l.fields(
          "",
          ["_class", "do_objectID", "name"],
          "Editable Equivalent",
          "Sketch Layer Style fills and borders retained as direct values and variable bindings; compatible effects use native effect styles."
        );
      } catch (e) {
        ctx.finding("STYLE_FAILURE", String(e), shared, "", "error");
      }
    }
    for (const shared of [
      ...doc.layerTextStyles?.objects ?? [],
      ...(doc.foreignTextStyles ?? []).map((s) => s.localSharedStyle).filter(Boolean)
    ]) {
      if (!selected(shared, "textStyles", ctx.resourceSelection?.styles))
        continue;
      const id = sourceId(shared), attrs = shared.value?.textStyle?.encodedAttributes ?? {};
      try {
        const l = ctx.ledger(shared), base = "/value/textStyle/encodedAttributes";
        const color = attrs.MSAttributedStringColorAttribute;
        const textFills = shared.value?.fills ?? [];
        const skipColors = shared.value?.textStyle?.skipColors === true;
        if (!skipColors && (textFills.length || color)) {
          const paints = [];
          if (textFills.length) {
            for (const [i2, f] of textFills.entries()) {
              const converted = await paint(ctx, shared, f, `/value/fills/${i2}`);
              if (converted) paints.push(converted);
            }
          } else
            paints.push(
              solidPaint(
                ctx,
                shared,
                color,
                `${base}/MSAttributedStringColorAttribute`
              )
            );
          ctx.resources.paints.set(id, paints);
        }
        const t = await style(
          ctx,
          `text:${id}`,
          "TEXT",
          shared.name,
          shared,
          async (r) => {
            const text = r, descriptor = attrs.MSAttributedStringFontAttribute;
            text.fontName = await resolveFont(
              ctx,
              descriptor,
              shared,
              "/value/textStyle/encodedAttributes/MSAttributedStringFontAttribute"
            );
            text.fontSize = Math.max(1, descriptor?.attributes?.size ?? 12);
            text.letterSpacing = { unit: "PIXELS", value: attrs.kerning ?? 0 };
            const p = attrs.paragraphStyle ?? {};
            const height = p.maximumLineHeight || p.minimumLineHeight;
            text.lineHeight = height > 0 ? { unit: "PIXELS", value: height } : { unit: "AUTO" };
            text.paragraphIndent = p.firstLineHeadIndent ?? 0;
            text.textDecoration = attrs.underlineStyle === 1 ? "UNDERLINE" : attrs.strikethroughStyle === 1 ? "STRIKETHROUGH" : "NONE";
            l.mark(`${base}/MSAttributedStringFontAttribute/attributes/size`);
            l.fields(base, [
              "kerning",
              "MSAttributedStringTextTransformAttribute",
              "underlineStyle",
              "strikethroughStyle"
            ]);
            l.fields(`${base}/paragraphStyle`, [
              "_class",
              "paragraphSpacing",
              "firstLineHeadIndent"
            ]);
            l.fields(
              `${base}/paragraphStyle`,
              ["minimumLineHeight", "maximumLineHeight"],
              p.minimumLineHeight === p.maximumLineHeight ? "Native" : "Partial",
              "One Figma line height represents Sketch minimum/maximum line height."
            );
            text.paragraphSpacing = p.paragraphSpacing ?? 0;
            text.textCase = ["ORIGINAL", "UPPER", "LOWER"][attrs.MSAttributedStringTextTransformAttribute ?? 0] ?? "ORIGINAL";
          }
        );
        ctx.resources.texts.set(id, t);
        ctx.ledger(shared).mark(
          "/value/textStyle/skipColors",
          "Native",
          skipColors ? "Source partial Text Style excludes colors." : "Source colors retained directly on text with original variable bindings."
        );
        if (shared.value?.textStyle?.skipAlignment !== void 0)
          ctx.ledger(shared).mark(
            "/value/textStyle/skipAlignment",
            "Partial",
            "Figma Text Styles exclude alignment. Source layer alignment is applied independently and original style ownership is retained."
          );
        ctx.ledger(shared).fields(
          "",
          ["_class", "do_objectID", "name"],
          color || textFills.length ? "Editable Equivalent" : "Native",
          color || textFills.length ? "Original Text Style retained; colors applied directly on text without additional styles." : void 0
        );
      } catch (e) {
        ctx.finding("TEXT_STYLE_FAILURE", String(e), shared, "", "error");
      }
    }
    for (const asset of doc.assets?.gradientAssets ?? []) {
      if (!selected(asset, "colors", ctx.resourceSelection?.styles)) continue;
      try {
        const converted = await paint(
          ctx,
          asset,
          { fillType: 1, gradient: asset.gradient },
          "/gradientAsset"
        );
        if (converted) ctx.resources.paints.set(sourceId(asset), [converted]);
      } catch (e) {
        ctx.finding("GRADIENT_STYLE", String(e), asset);
      }
    }
    if (ctx.options.tokens) await importTokens(ctx, ctx.options.tokens);
    (_a2 = ctx.index).resourceAudits ?? (_a2.resourceAudits = {});
    for (const [id, ledger] of ctx.ledgers)
      ctx.index.resourceAudits[id] = ledger.finalize();
  }
  function validateTokens(value) {
    const t = value;
    if (!t || typeof t.collection !== "string" || !Array.isArray(t.modes) || !t.modes.length || !t.modes.every((m) => typeof m === "string") || new Set(t.modes).size !== t.modes.length || !Array.isArray(t.tokens))
      throw new Error(
        "Token JSON requires collection, unique modes[], and tokens[]."
      );
    if (t.bindings !== void 0 && (!Array.isArray(t.bindings) || !t.bindings.every(
      (b) => b && typeof b.sourceId === "string" && typeof b.field === "string" && typeof b.token === "string"
    )))
      throw new Error(
        "Token bindings require sourceId, field, and token strings."
      );
    const boundFields = /* @__PURE__ */ new Set();
    for (const b of t.bindings ?? []) {
      const key = `${b.sourceId}:${b.field}`;
      if (boundFields.has(key)) throw new Error(`Duplicate token binding ${key}`);
      boundFields.add(key);
    }
    const names = /* @__PURE__ */ new Set();
    for (const token of t.tokens) {
      if (typeof token.name !== "string" || names.has(token.name) || !["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(token.type) || !token.values)
        throw new Error("Invalid or duplicate token.");
      names.add(token.name);
      for (const mode of t.modes) {
        const value2 = token.values[mode];
        if (value2 === void 0)
          throw new Error(`Missing ${mode} value for ${token.name}`);
        if (typeof value2 === "string" && /^\{.+\}$/.test(value2)) continue;
        const valid = token.type === "FLOAT" ? typeof value2 === "number" && Number.isFinite(value2) : token.type === "BOOLEAN" ? typeof value2 === "boolean" : token.type === "STRING" ? typeof value2 === "string" : !!value2 && typeof value2 === "object" && ["r", "g", "b"].every(
          (k) => typeof value2[k] === "number" && value2[k] >= 0 && value2[k] <= 1
        ) && (value2.a === void 0 || typeof value2.a === "number" && value2.a >= 0 && value2.a <= 1);
        if (!valid)
          throw new Error(
            `Invalid ${token.type} value for ${token.name}/${mode}`
          );
      }
    }
    return t;
  }
  function tokenScopes(tokens, name, type) {
    const fields = (tokens.bindings ?? []).filter((b) => b.token === name).map((b) => b.field);
    const scope = (field) => /Radius$|^cornerRadius$/.test(field) ? "CORNER_RADIUS" : /^(min|max)?(Width|Height)$|^(width|height)$/.test(field) ? "WIDTH_HEIGHT" : /padding|Spacing$|Gap$/.test(field) ? field === "letterSpacing" ? "LETTER_SPACING" : field === "paragraphSpacing" ? "PARAGRAPH_SPACING" : "GAP" : field === "fontFamily" ? "FONT_FAMILY" : field === "fontStyle" ? "FONT_STYLE" : field === "fontSize" ? "FONT_SIZE" : field === "fontWeight" ? "FONT_WEIGHT" : field === "lineHeight" ? "LINE_HEIGHT" : field === "paragraphIndent" ? "PARAGRAPH_INDENT" : field === "characters" ? "TEXT_CONTENT" : field === "opacity" ? "OPACITY" : /^stroke/.test(field) ? "STROKE_FLOAT" : "ALL_SCOPES";
    if (type === "COLOR")
      return [
        "FRAME_FILL",
        "SHAPE_FILL",
        "TEXT_FILL",
        "STROKE_COLOR",
        "EFFECT_COLOR"
      ];
    return fields.length ? [...new Set(fields.map(scope))] : ["ALL_SCOPES"];
  }
  async function preloadTokenFontValues(ctx, tokens) {
    const read = (name, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(name)) return [];
      seen.add(name);
      return Object.values(
        tokens.tokens.find((t) => t.name === name)?.values ?? {}
      ).flatMap(
        (v) => typeof v !== "string" ? [] : /^\{.+\}$/.test(v) ? read(v.slice(1, -1), seen) : [v]
      );
    };
    const needed = /* @__PURE__ */ new Map();
    for (const b of tokens.bindings ?? [])
      if (b.field === "fontFamily" || b.field === "fontStyle") {
        for (const value of read(b.token))
          for (const font of ctx.fonts)
            if (b.field === "fontFamily" ? font.fontName.family === value : font.fontName.style === value)
              needed.set(JSON.stringify(font.fontName), font.fontName);
      }
    for (const font of needed.values()) await ctx.api.loadFontAsync(font);
  }
  async function importTokens(ctx, input) {
    const tokens = validateTokens(input), key = `tokens:${tokens.collection}`;
    const selectedTokens = tokens.tokens.filter(
      (token) => !ctx.resourceSelection || ctx.resourceSelection.tokenNames.has(token.name)
    );
    const tokenSource = {
      ...tokens,
      _class: "tokenFile",
      do_objectID: `${ctx.file.documentId}:tokens`,
      name: tokens.collection
    };
    const ledger = ctx.ledger(tokenSource, selectedTokens.length > 0);
    if (!selectedTokens.length) {
      for (const property of ledger.finalize().properties)
        ledger.mark(
          property.path,
          "Unsupported",
          "Unused supplied token excluded by import options; original definition retained."
        );
      return;
    }
    for (const [i2, token] of tokens.tokens.entries())
      if (!ctx.resourceSelection?.tokenNames.has(token.name) && ctx.resourceSelection) {
        for (const property of ledger.finalize().properties)
          if (property.path.startsWith(`/tokens/${i2}/`))
            ledger.mark(
              property.path,
              "Unsupported",
              "Unused supplied token excluded by import options; original definition retained."
            );
      }
    ledger.fields("", ["_class", "do_objectID", "name", "collection"]);
    let collection = null;
    const id = ctx.index.resources[key];
    if (id)
      collection = await ctx.api.variables.getVariableCollectionByIdAsync(id);
    if (!collection) {
      collection = ctx.api.variables.createVariableCollection(tokens.collection);
      ctx.journal.trackResource(collection);
      ctx.index.resources[key] = collection.id;
    }
    ctx.journal.beforeResource?.(collection);
    const modes = new Map(collection.modes.map((m) => [m.name, m.modeId]));
    if (!modes.has(tokens.modes[0]) && collection.modes.length === 1) {
      collection.renameMode(collection.defaultModeId, tokens.modes[0]);
      modes.set(tokens.modes[0], collection.defaultModeId);
    }
    for (const name of tokens.modes)
      if (!modes.has(name)) {
        try {
          modes.set(name, collection.addMode(name));
        } catch (e) {
          ctx.finding(
            "VARIABLE_MODE_LIMIT",
            `${name}: ${e}`,
            void 0,
            key,
            "error"
          );
        }
      }
    for (const [i2, name] of tokens.modes.entries())
      if (modes.has(name)) ledger.mark(`/modes/${i2}`);
    const variables = /* @__PURE__ */ new Map(), preserved = /* @__PURE__ */ new Set();
    for (const token of selectedTokens) {
      let v = null;
      const explicit = ctx.options.variableMap[token.name], prior = explicit ?? ctx.index.resources[`${key}:${token.name}`];
      if (prior)
        v = prior.startsWith("key:") ? await ctx.api.variables.importVariableByKeyAsync(prior.slice(4)) : await ctx.api.variables.getVariableByIdAsync(prior);
      if (explicit && !v)
        throw new Error(
          `Explicit token mapping ${token.name} was not found: ${explicit}`
        );
      if (v && v.resolvedType !== token.type)
        throw new Error(`Token type mismatch ${token.name}`);
      if (!v) {
        v = ctx.api.variables.createVariable(token.name, collection, token.type);
        v.scopes = tokenScopes(tokens, token.name, token.type);
        ctx.journal.trackResource(v);
      } else {
        const record = ctx.index.resourceStates?.[`${key}:${token.name}`];
        if (explicit || ctx.options.conflict === "preserve-local" && (!record || fingerprint({ name: v.name, valuesByMode: v.valuesByMode }) !== record.targetHash)) {
          preserved.add(token.name);
          ctx.finding(
            explicit ? "TOKEN_MAPPING" : "RESOURCE_CONFLICT",
            `Existing token ${token.name} retained.`,
            void 0,
            `${key}:${token.name}`
          );
        } else ctx.journal.beforeResource?.(v);
      }
      variables.set(token.name, v);
      ctx.index.resources[`${key}:${token.name}`] = v.id;
      ctx.resources.variables.set(token.name, v);
      const i2 = tokens.tokens.indexOf(token);
      ledger.fields(`/tokens/${i2}`, ["name", "type"]);
    }
    await preloadTokenFontValues(ctx, tokens);
    const visiting = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set();
    const apply = (name) => {
      if (done.has(name)) return;
      if (preserved.has(name)) {
        const token2 = tokens.tokens.find((t) => t.name === name);
        for (const mode of tokens.modes) {
          const path = `/tokens/${tokens.tokens.indexOf(token2)}/values/${escapePointer(mode)}`, value = token2.values[mode];
          if (value && typeof value === "object")
            ledger.fields(
              path,
              Object.keys(value),
              "Partial",
              "Explicit mapping or preserved local value takes precedence."
            );
          else
            ledger.mark(
              path,
              "Partial",
              "Explicit mapping or preserved local value takes precedence."
            );
        }
        return;
      }
      if (visiting.has(name)) throw new Error(`Circular token alias ${name}`);
      visiting.add(name);
      const token = tokens.tokens.find((t) => t.name === name);
      const variable = variables.get(name);
      for (const mode of tokens.modes) {
        const modeId = modes.get(mode);
        if (!modeId) continue;
        const value = token.values[mode];
        const path = `/tokens/${tokens.tokens.indexOf(token)}/values/${escapePointer(mode)}`;
        if (typeof value === "string" && /^\{.+\}$/.test(value)) {
          const target = value.slice(1, -1), alias = variables.get(target);
          if (!alias || alias.resolvedType !== token.type) {
            ctx.finding(
              "TOKEN_ALIAS",
              `Missing or incompatible token alias ${target}.`,
              void 0,
              `${name}/${mode}`,
              "error"
            );
            continue;
          }
          apply(target);
          variable.setValueForMode(
            modeId,
            ctx.api.variables.createVariableAlias(alias)
          );
          ledger.mark(path);
        } else {
          try {
            variable.setValueForMode(modeId, value);
            if (value && typeof value === "object")
              ledger.fields(path, Object.keys(value));
            else ledger.mark(path);
          } catch (e) {
            ctx.finding(
              "TOKEN_VALUE",
              `${name}/${mode}: ${e}`,
              void 0,
              key,
              "error"
            );
          }
        }
      }
      remember(ctx, `${key}:${name}`, token, variable);
      visiting.delete(name);
      done.add(name);
    };
    for (const token of selectedTokens)
      try {
        apply(token.name);
      } catch (e) {
        ctx.finding("TOKEN_CYCLE", String(e), void 0, key, "error");
      }
  }
  async function bindStyles(ctx, s, node) {
    const id = s.sharedStyleID;
    if (!id) return;
    const paint2 = ctx.resources.paints.get(id), stroke = ctx.resources.strokes.get(id), effect = ctx.resources.effects.get(id), text = ctx.resources.texts.get(id);
    let bound = false, overridden = false;
    const override = (field) => {
      overridden = true;
      ctx.finding(
        "LOCAL_STYLE_OVERRIDE",
        `${s.name}: source ${field} overrides the shared style. Editable source values retained; Figma cannot bind that overridden resource as a whole.`,
        s,
        "/sharedStyleID",
        "warning",
        "layerStyles"
      );
    };
    try {
      if (paint2 && "fills" in node) {
        if (s.style?.fills === void 0 || node.type === "TEXT" && !s.style.fills.length)
          node.fills = paint2;
        bound = true;
      }
      if (stroke && "strokes" in node) {
        if (s.style?.borders === void 0) node.strokes = stroke;
        bound = true;
      }
      if (effect && "setEffectStyleIdAsync" in node) {
        if (s.style && "effects" in node && !sameValue(node.effects, effect.effects))
          override("effects");
        else {
          await node.setEffectStyleIdAsync(effect.id);
          bound = true;
        }
      }
      if (text && node.type === "TEXT") {
        await node.setTextStyleIdAsync(text.id);
        bound = true;
      }
      if (bound || overridden)
        ctx.ledger(s).mark(
          "/sharedStyleID",
          overridden || paint2 || stroke ? "Partial" : "Native",
          overridden ? "Explicit source appearance overrides retained; conflicting style parts cannot remain bound." : paint2 || stroke ? "Source colors retained as direct paints and variable bindings; original shared style identity retained in metadata." : void 0
        );
      else
        ctx.finding(
          "STYLE_REFERENCE",
          `Unresolved shared style ${id}.`,
          s,
          "/sharedStyleID"
        );
    } catch (e) {
      ctx.finding("STYLE_BINDING", String(e), s, "/sharedStyleID", "error");
    }
  }
  async function removeUnusedGeneratedStyles(ctx) {
    const legacy = Object.entries(ctx.index.resources).filter(
      ([key]) => /^(paint:|stroke:|gradient:|text-override:)/.test(key)
    );
    if (!legacy.length) return;
    const used = /* @__PURE__ */ new Set();
    for (const page of ctx.api.root.children) {
      for (const node of page.findAll(() => true)) {
        for (const field of [
          "fillStyleId",
          "strokeStyleId",
          "textStyleId"
        ]) {
          const value = node[field];
          if (typeof value === "string" && value) used.add(value);
        }
        if ((node.type === "TEXT" || node.type === "TEXT_PATH") && node.characters.length)
          for (const range of node.getStyledTextSegments([
            "fillStyleId",
            "textStyleId"
          ])) {
            if (range.fillStyleId) used.add(range.fillStyleId);
            if (range.textStyleId) used.add(range.textStyleId);
          }
      }
    }
    for (const [key, id] of legacy) {
      const style2 = await ctx.api.getStyleByIdAsync(id);
      const record = ctx.index.resourceStates?.[key];
      const snapshot = style2?.type === "TEXT" ? { name: style2.name, ...textStyleValues(style2) } : style2 ? styleSnapshot(style2) : null;
      if (style2 && (ctx.options.styleMap[key] || !record || used.has(id) || fingerprint(snapshot) !== record.targetHash)) {
        ctx.finding(
          "LEGACY_STYLE_RETAINED",
          `${style2.name}: an older generated style is still referenced, mapped, or locally edited; retained to protect existing work.`,
          void 0,
          key,
          "warning",
          style2.type === "TEXT" ? "textStyles" : "layerStyles"
        );
        continue;
      }
      style2?.remove();
      delete ctx.index.resources[key];
      if (ctx.index.resourceStates) delete ctx.index.resourceStates[key];
    }
  }

  // src/figma/symbols.ts
  function overrideTarget(instance, path) {
    let container = instance;
    for (const id of path) {
      if (!("children" in container)) return void 0;
      const find = (nodes) => {
        for (const node of nodes) {
          const source = node.getPluginData("sketch2figma:sourceId");
          if (source === id) return node;
          if (node.type !== "INSTANCE" && "children" in node) {
            const nested = find(node.children);
            if (nested) return nested;
          }
        }
        return void 0;
      };
      const found = find(container.children);
      if (!found) return void 0;
      container = found;
    }
    return container;
  }
  async function propertyOverride(root, target, field, value) {
    const key = target.componentPropertyReferences?.[field];
    if (!key) return false;
    let owner = target.parent;
    while (owner) {
      if (owner.type === "INSTANCE" && (await owner.getMainComponentAsync())?.componentPropertyDefinitions[key]) {
        owner.setProperties({ [key]: value });
        return true;
      }
      if (owner.id === root.id) break;
      owner = owner.parent;
    }
    return false;
  }
  async function applyOverrides(ctx, s, instance) {
    const overrides = [...s.overrideValues ?? []].map((o, i2) => ({ o, i: i2 })).sort((a, b) => {
      const priority = (name) => name.endsWith("_symbolID") ? 0 : /_(layerStyle|textStyle)$/.test(name) ? 1 : 2;
      return priority(a.o.overrideName) - priority(b.o.overrideName) || a.o.overrideName.split("/").length - b.o.overrideName.split("/").length;
    });
    for (const { o, i: i2 } of overrides) {
      const match = String(o.overrideName).match(/^(.*)_([^_]+)$/), path = `/overrideValues/${i2}`;
      if (!match) {
        ctx.finding(
          "OVERRIDE_NAME",
          "Unrecognized Symbol override name.",
          s,
          path
        );
        continue;
      }
      const ids = match[1].split("/"), kind = match[2], target = overrideTarget(instance, ids);
      if (!target) {
        ctx.finding(
          "OVERRIDE_TARGET",
          `Missing target ${match[1]} in linked instance.`,
          s,
          path
        );
        continue;
      }
      const ok = await ctx.attempt(
        s,
        path,
        async () => {
          if (kind === "stringValue" && (target.type === "TEXT" || target.type === "TEXT_PATH")) {
            await loadCurrentFonts(ctx, target);
            if (!await propertyOverride(instance, target, "characters", String(o.value))) target.characters = String(o.value);
          } else if (kind === "isVisible") {
            const value = o.value !== false && o.value !== 0 && o.value !== "0";
            if (!await propertyOverride(instance, target, "visible", value)) target.visible = value;
          } else if (kind === "symbolID" && target.type === "INSTANCE") {
            if (o.value === "") target.visible = false;
            else {
              const master = ctx.resources.components.get(String(o.value));
              if (!master) throw new Error(`Unresolved Symbol swap ${o.value}`);
              if (!await propertyOverride(instance, target, "mainComponent", master.id)) target.swapComponent(master);
            }
          } else if (kind === "textColor" && (target.type === "TEXT" || target.type === "TEXT_PATH")) {
            target.fills = [solidPaint(ctx, s, o.value, `${path}/value`)];
          } else if (/^color:(fill|border)-\d+$/.test(kind)) {
            const colorMatch = kind.match(/^color:(fill|border)-(\d+)$/);
            const field = colorMatch[1] === "fill" ? "fills" : "strokes", index = Number(colorMatch[2]);
            if (!(field in target)) throw new Error(`Target does not support ${field}.`);
            const current = target[field];
            if (typeof current === "symbol" || !current[index] || current[index].type !== "SOLID") throw new Error(`Color override ${kind} requires an existing solid paint.`);
            const fills = [...current], color = solidPaint(ctx, s, o.value, `${path}/value`);
            fills[index] = { ...fills[index], color: color.color, opacity: color.opacity, boundVariables: color.boundVariables };
            target[field] = fills;
          } else if (kind === "image" && "fills" in target) {
            const hash = await imageHash(ctx, o.value);
            if (!hash) throw new Error("Missing override image");
            const fills = typeof target.fills === "symbol" ? [] : target.fills;
            target.fills = fills.map(
              (p) => p.type === "IMAGE" ? { ...p, imageHash: hash } : p
            );
          } else if (kind === "layerStyle" && "setFillStyleIdAsync" in target) {
            const paint2 = ctx.resources.paints.get(String(o.value));
            const effect = ctx.resources.effects.get(String(o.value));
            const stroke = ctx.resources.strokes.get(String(o.value));
            if (!paint2 && !effect && !stroke)
              throw new Error("Missing layer style override");
            if (paint2) target.fills = paint2;
            if (stroke && "strokes" in target) target.strokes = stroke;
            if (effect && "setEffectStyleIdAsync" in target)
              await target.setEffectStyleIdAsync(effect.id);
          } else if (kind === "textStyle" && target.type === "TEXT") {
            const style2 = ctx.resources.texts.get(String(o.value));
            if (!style2) throw new Error("Missing text style override");
            await loadCurrentFonts(ctx, target);
            await ctx.api.loadFontAsync(style2.fontName);
            await target.setTextStyleIdAsync(style2.id);
            const paint2 = ctx.resources.paints.get(String(o.value));
            if (paint2) target.fills = paint2;
          } else
            throw new Error(
              `Unsupported override ${kind}; original override retained.`
            );
        },
        ["_class", "overrideName", "value"]
      );
      if (ok && kind === "symbolID" && o.value === "")
        ctx.ledger(s).mark(`${path}/value`, "Editable Equivalent", "Empty Sketch Symbol swap represented by native instance visibility.");
      if (ok && typeof o.value === "object")
        ctx.ledger(s).fields(`${path}/value`, ["_class", "_ref_class", "_ref"]);
    }
  }
  async function componentProperties(ctx, s, component) {
    const owned2 = readData(component, "componentProperties", {});
    for (const [i2, p] of (s.overrideProperties ?? []).entries()) {
      const name = String(p.overrideName ?? ""), m = name.match(/^(.*)_(stringValue|isVisible|symbolID)$/);
      if (!m || p.canOverride === false) continue;
      const target = overrideTarget(
        component,
        m[1].split("/")
      );
      if (!target) continue;
      try {
        const type = m[2] === "stringValue" ? "TEXT" : m[2] === "isVisible" ? "BOOLEAN" : "INSTANCE_SWAP";
        const initial = type === "TEXT" && "characters" in target ? target.characters : type === "BOOLEAN" ? target.visible : target.type === "INSTANCE" ? (await target.getMainComponentAsync())?.id : void 0;
        if (initial === void 0) continue;
        const existing = owned2[name];
        const id = existing && component.componentPropertyDefinitions[existing]?.type === type ? component.editComponentProperty(existing, { defaultValue: initial }) : component.addComponentProperty(`${target.name} / ${m[2]}`, type, initial);
        owned2[name] = id;
        target.componentPropertyReferences = {
          ...target.componentPropertyReferences,
          [type === "TEXT" ? "characters" : type === "BOOLEAN" ? "visible" : "mainComponent"]: id
        };
        ctx.ledger(s).fields(
          `/overrideProperties/${i2}`,
          ["_class", "overrideName", "canOverride"],
          "Partial",
          "Supported override exposed as a native component property; Sketch override-permission semantics differ."
        );
      } catch (e) {
        ctx.finding(
          "COMPONENT_PROPERTY",
          String(e),
          s,
          `/overrideProperties/${i2}`
        );
      }
    }
    writeData(component, "componentProperties", owned2);
  }

  // src/figma/prototypes.ts
  function pageOf(node) {
    let p = node;
    while (p && p.type !== "PAGE") p = p.parent;
    return p?.type === "PAGE" ? p : void 0;
  }
  function transition(ctx, s) {
    const flow = s.flow;
    if (!flow?.animationType) return null;
    const direction = ["LEFT", "LEFT", "RIGHT", "BOTTOM", "TOP"][flow.animationType];
    if (!direction) {
      ctx.finding(
        "PROTOTYPE_TRANSITION",
        `Unsupported animation type ${flow.animationType}.`,
        s,
        "/flow/animationType"
      );
      return null;
    }
    ctx.ledger(s).mark(
      "/flow/animationType",
      "Partial",
      "Native directional transition; missing source duration/easing uses 0.3s Ease In And Out."
    );
    return {
      type: "SLIDE_IN",
      direction,
      matchLayers: false,
      duration: finite(flow.duration, 0.3),
      easing: { type: "EASE_IN_AND_OUT" }
    };
  }
  async function applyPrototypes(ctx, mutable) {
    const all = walkLayers(ctx.file.pages), cross = all.filter((s) => {
      const n = ctx.nodes.get(sourceId(s)), d = ctx.nodes.get(String(s.flow?.destinationArtboardID));
      return n && d && pageOf(n)?.id !== pageOf(d)?.id;
    });
    let generated;
    if (cross.length && ctx.options.generatePrototypePage) {
      const page = ctx.api.createPage();
      ctx.journal.track(page);
      page.name = `${ctx.file.name} / Prototype arrangement`;
      generated = /* @__PURE__ */ new Map();
      let x2 = 0;
      for (const source of all.filter((s) => s._class === "artboard")) {
        const node = ctx.nodes.get(sourceId(source));
        if (!node) continue;
        const clone = node.clone();
        ctx.journal.track(clone);
        page.appendChild(clone);
        clone.x = x2;
        clone.y = 0;
        x2 += clone.width + 120;
        const index = (n) => {
          const id = n.getPluginData("sketch2figma:sourceId");
          if (id) generated.set(id, n);
          if ("children" in n) for (const c of n.children) index(c);
        };
        index(clone);
      }
      ctx.finding(
        "PROTOTYPE_ARRANGEMENT",
        "Generated a separate single-page prototype arrangement for cross-page links; source page hierarchy is retained.",
        void 0,
        void 0,
        "info"
      );
    }
    for (const s of all) {
      const id = sourceId(s);
      if (!s.flow) continue;
      const targets = [
        ...mutable.has(id) ? [ctx.nodes.get(id)] : [],
        generated?.get(id)
      ].filter(Boolean);
      for (const node of targets) {
        if (!("setReactionsAsync" in node)) continue;
        const dest = String(s.flow.destinationArtboardID);
        let action;
        if (dest === "back") action = { type: "BACK" };
        else if (/^https?:\/\//.test(dest)) action = { type: "URL", url: dest };
        else {
          const destination = (generated && pageOf(node)?.id === pageOf(generated.get(id))?.id ? generated : ctx.nodes)?.get(dest);
          if (!destination) {
            ctx.finding(
              "PROTOTYPE_DESTINATION",
              `Missing navigation destination ${dest}.`,
              s,
              "/flow/destinationArtboardID"
            );
            continue;
          }
          if (pageOf(node)?.id !== pageOf(destination)?.id) {
            ctx.finding(
              "CROSS_PAGE_PROTOTYPE",
              "Cross-page navigation requires the optional generated prototype arrangement.",
              s,
              "/flow/destinationArtboardID"
            );
            continue;
          }
          action = {
            type: "NODE",
            destinationId: destination.id,
            navigation: "NAVIGATE",
            transition: transition(ctx, s),
            resetScrollPosition: !s.flow.maintainScrollPosition
          };
        }
        await ctx.attempt(
          s,
          "/flow",
          async () => {
            await node.setReactionsAsync([
              { trigger: { type: "ON_CLICK" }, actions: [action] }
            ]);
          },
          ["_class", "destinationArtboardID", "maintainScrollPosition"]
        );
        if (!s.flow.animationType) ctx.ledger(s).mark("/flow/animationType");
      }
    }
    for (const p of ctx.file.pages) {
      const pid = ctx.index.pages[sourceId(p)], page = pid ? await ctx.api.getNodeByIdAsync(pid) : null;
      if (!page || page.type !== "PAGE") continue;
      const starts = (p.layers ?? []).filter((s) => s.isFlowHome && ctx.nodes.has(sourceId(s))).map((s) => {
        ctx.ledger(s).mark("/isFlowHome");
        return { nodeId: ctx.nodes.get(sourceId(s)).id, name: s.name };
      });
      if (starts.length) {
        ctx.journal.beforePage?.(page);
        page.flowStartingPoints = [
          ...page.flowStartingPoints.filter(
            (f) => !starts.some((s) => s.nodeId === f.nodeId)
          ),
          ...starts
        ];
      }
    }
  }

  // src/figma/token-bindings.ts
  var numeric = /* @__PURE__ */ new Set([
    "height",
    "width",
    "itemSpacing",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "counterAxisSpacing",
    "strokeWeight",
    "strokeTopWeight",
    "strokeRightWeight",
    "strokeBottomWeight",
    "strokeLeftWeight",
    "opacity",
    "gridRowGap",
    "gridColumnGap",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "paragraphSpacing",
    "paragraphIndent"
  ]);
  var strings = /* @__PURE__ */ new Set(["characters", "fontFamily", "fontStyle"]);
  var TEXT_TOKEN_FIELDS = /* @__PURE__ */ new Set([
    "fontFamily",
    "fontStyle",
    "fontWeight",
    "fontSize",
    "letterSpacing",
    "lineHeight",
    "paragraphSpacing",
    "paragraphIndent"
  ]);
  async function fontValues(ctx, variable, visited = /* @__PURE__ */ new Set()) {
    if (visited.has(variable.id)) return /* @__PURE__ */ new Set();
    visited.add(variable.id);
    const values = /* @__PURE__ */ new Set();
    for (const value of Object.values(variable.valuesByMode)) {
      if (typeof value === "string") values.add(value);
      else if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
        const alias = await ctx.api.variables.getVariableByIdAsync(value.id);
        if (alias)
          for (const item of await fontValues(ctx, alias, visited))
            values.add(item);
      }
    }
    return values;
  }
  async function prepareBoundFonts(ctx, node, field, variable) {
    await loadCurrentFonts(ctx, node);
    if (field !== "fontFamily" && field !== "fontStyle") return;
    const values = await fontValues(ctx, variable), current = currentFontNames(node), families = new Set(current.map((f) => f.family));
    for (const value of values) {
      const candidates = ctx.fonts.filter(
        (f) => field === "fontFamily" ? f.fontName.family === value : families.has(f.fontName.family) && f.fontName.style === value
      );
      if (!candidates.length)
        throw new Error(`Missing font token ${field}: ${value}`);
      for (const font of candidates) await ctx.api.loadFontAsync(font.fontName);
    }
  }
  async function applyTokenBindings(ctx, preserved) {
    const file = ctx.options.tokens;
    if (!file) return;
    const source = {
      ...file,
      _class: "tokenFile",
      do_objectID: `${ctx.file.documentId}:tokens`,
      name: file.collection
    };
    const ledger = ctx.ledger(source);
    const current = /* @__PURE__ */ new Map();
    for (const [i2, binding] of (file.bindings ?? []).entries()) {
      const path = `/bindings/${i2}`, node = ctx.nodes.get(binding.sourceId), variable = ctx.resources.variables.get(binding.token);
      if (!node) {
        ctx.finding(
          "TOKEN_BINDING_SCOPE",
          `Token target ${binding.sourceId} was not imported.`,
          source,
          path
        );
        continue;
      }
      if (preserved.has(binding.sourceId)) {
        ctx.finding(
          "TOKEN_BINDING_CONFLICT",
          `Token binding ${binding.field} was not changed because local edits were preserved.`,
          source,
          path
        );
        continue;
      }
      const field = binding.field;
      const type = numeric.has(field) ? "FLOAT" : strings.has(field) ? "STRING" : field === "visible" ? "BOOLEAN" : void 0;
      const textField = TEXT_TOKEN_FIELDS.has(field);
      const textNode = node.type === "TEXT" || node.type === "TEXT_PATH";
      if (!type || (textField ? !textNode : !(field in node)) || !variable || variable.resolvedType !== type) {
        ctx.finding(
          "TOKEN_BINDING",
          `Missing or incompatible token ${binding.token} for ${binding.sourceId}.${field}.`,
          source,
          path,
          "error"
        );
        continue;
      }
      await ctx.journal.before(node);
      const ok = await ctx.attempt(
        source,
        path,
        async () => {
          if (node.type === "TEXT" || node.type === "TEXT_PATH")
            await prepareBoundFonts(ctx, node, field, variable);
          node.setBoundVariable(field, variable);
          const alias = textField && (node.type === "TEXT" || node.type === "TEXT_PATH") ? node.getRangeBoundVariable(
            0,
            node.characters.length,
            field
          ) : node.boundVariables?.[field];
          const passed = !!alias && typeof alias !== "symbol" && !Array.isArray(alias) && alias.id === variable.id;
          ctx.report.validations.push({
            kind: "token-binding",
            sourceId: binding.sourceId,
            passed,
            expected: variable.id,
            actual: alias,
            message: `${node.name}: ${field} retains supplied ${binding.token} binding.`
          });
          if (!passed)
            throw new Error(`Host did not retain ${binding.token} on ${field}.`);
        },
        ["sourceId", "field", "token"]
      );
      if (ok) {
        const owned2 = current.get(binding.sourceId) ?? {};
        owned2[field] = variable.id;
        current.set(binding.sourceId, owned2);
      }
    }
    for (const [id, node] of ctx.nodes) {
      if (preserved.has(id)) continue;
      const previous = readData(
        node,
        "tokenBindings",
        {}
      ), next = current.get(id) ?? {};
      for (const [field, variableId] of Object.entries(previous)) {
        if (field in next) continue;
        const alias = TEXT_TOKEN_FIELDS.has(field) && (node.type === "TEXT" || node.type === "TEXT_PATH") ? node.getRangeBoundVariable(
          0,
          node.characters.length,
          field
        ) : node.boundVariables?.[field];
        if (alias?.id === variableId) {
          await ctx.journal.before(node);
          node.setBoundVariable(field, null);
        }
      }
      if (Object.keys(previous).length || Object.keys(next).length)
        writeData(node, "tokenBindings", next);
    }
    ledger.fields("", ["_class", "do_objectID", "name"]);
  }

  // src/figma/instance-text-styles.ts
  function instanceTextSources(instance, source) {
    const overrides = /* @__PURE__ */ new Map();
    const collect = (node) => {
      if ("children" in node) for (const child of node.children) collect(child);
      if (node.type !== "INSTANCE") return;
      const original = node === instance ? source : readData(node, "source", null);
      for (const override of original?.overrideValues ?? []) {
        const match = String(override.overrideName).match(/^(.*)_textStyle$/);
        if (!match) continue;
        const target = overrideTarget(node, match[1].split("/"));
        if (target?.type === "TEXT")
          overrides.set(target.id, String(override.value));
      }
    };
    collect(instance);
    const result = [];
    const visit = (node) => {
      if (node.type === "TEXT") {
        const original = readData(node, "source", null);
        if (original || overrides.has(node.id))
          result.push({
            node,
            source: {
              ...original ?? {
                _class: "text",
                do_objectID: node.id,
                name: node.name
              },
              sharedStyleID: overrides.get(node.id) ?? original?.sharedStyleID
            }
          });
      }
      if ("children" in node) for (const child of node.children) visit(child);
    };
    visit(instance);
    return result;
  }

  // src/figma/detail-validation.ts
  async function validateDetails(ctx, source, node) {
    const target = node;
    const supplied = new Set(
      (ctx.options.tokens?.bindings ?? []).filter((b) => b.sourceId === sourceId(source)).map((b) => b.field)
    );
    const check = (kind, values, path) => {
      const expected = {}, actual = {};
      for (const [field, value] of Object.entries(values)) {
        if (supplied.has(field)) continue;
        expected[field] = value;
        actual[field] = target[field];
      }
      if (!Object.keys(expected).length) return;
      const changed = Object.keys(expected).filter(
        (key) => typeof expected[key] === "number" && typeof actual[key] === "number" ? !Number.isFinite(expected[key]) || !Number.isFinite(actual[key]) || Math.abs(expected[key] - actual[key]) > 0.01 : expected[key] !== actual[key]
      );
      ctx.report.validations.push({
        kind,
        sourceId: sourceId(source),
        expected,
        actual,
        passed: !changed.length,
        message: `${source.name}: ${kind} ${changed.length ? `readback differs in ${changed.join(", ")}` : "readback matches source"}.`
      });
      if (changed.length) {
        ctx.ledger(source).mark(
          path,
          "Partial",
          `Native readback differs in ${changed.join(", ")}; see ${kind} validation.`
        );
        ctx.finding(
          "DETAIL_DIFFERENCE",
          `${source.name}: ${kind} differs in ${changed.join(", ")}.`,
          source,
          path
        );
      }
    };
    const g = source.groupLayout;
    if (g?._class === "MSImmutableFlexGroupLayout" && "layoutMode" in node) {
      const values = {
        layoutMode: g.flexDirection === 0 ? "HORIZONTAL" : "VERTICAL",
        layoutWrap: g.wrappingEnabled ? "WRAP" : "NO_WRAP",
        paddingTop: finite(source.topPadding),
        paddingRight: finite(source.rightPadding),
        paddingBottom: finite(source.bottomPadding),
        paddingLeft: finite(source.leftPadding),
        itemSpacing: finite(g.allGuttersGap)
      };
      if (g.wrappingEnabled)
        values.counterAxisSpacing = finite(g.crossAxisGutterGap);
      if ([0, 1].includes(g.stackingOrder))
        values.itemReverseZIndex = g.stackingOrder === 0;
      if (typeof g.bordersAffectLayout === "boolean")
        values.strokesIncludedInLayout = g.bordersAffectLayout;
      check("stack-layout", values, "/groupLayout");
    }
    if (node.parent && "layoutMode" in node.parent && node.parent.layoutMode !== "NONE")
      for (const [key, width, height] of [
        ["minSize", "minWidth", "minHeight"],
        ["maxSize", "maxWidth", "maxHeight"]
      ]) {
        if (source[key] === void 0 || !(width in node)) continue;
        try {
          const size = point(source[key]);
          check(
            "layout-limits",
            { [width]: size.x || null, [height]: size.y || null },
            `/${key}`
          );
        } catch (error) {
          ctx.finding(
            "VALIDATION_SOURCE",
            String(error),
            source,
            `/${key}`,
            "error"
          );
        }
      }
    const corners = source.style?.corners;
    if (corners?.radii?.length && [0, 1].includes(corners.style) && "topLeftRadius" in node) {
      const fields = [
        "topLeftRadius",
        "topRightRadius",
        "bottomRightRadius",
        "bottomLeftRadius"
      ];
      check(
        "corner-radii",
        Object.fromEntries(
          fields.map((field, i2) => [
            field,
            corners.radii[i2 % corners.radii.length]
          ])
        ),
        "/style/corners"
      );
    }
    const borders = source.style?.borders, border = borders?.find((b) => b.isEnabled) ?? borders?.[0];
    if (border && "strokeWeight" in node && [0, 1, 2].includes(border.position ?? 0))
      check(
        "border-geometry",
        {
          strokeWeight: Math.max(0, finite(border.thickness, 1)),
          strokeAlign: ["CENTER", "INSIDE", "OUTSIDE"][border.position ?? 0]
        },
        "/style/borders"
      );
    if (node.type === "INSTANCE") {
      const main = await node.getMainComponentAsync();
      if (!main || main.layoutMode === "NONE") return;
      const fields = [
        "layoutMode",
        "layoutWrap",
        "itemSpacing",
        "counterAxisSpacing",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "primaryAxisAlignItems",
        "counterAxisAlignItems",
        "itemReverseZIndex",
        "strokesIncludedInLayout"
      ];
      check(
        "component-layout",
        Object.fromEntries(fields.map((field) => [field, main[field]])),
        "/symbolID"
      );
      for (const field of fields) {
        const alias = main.boundVariables?.[field];
        if (!alias || Array.isArray(alias) || alias.type !== "VARIABLE_ALIAS" || supplied.has(field))
          continue;
        const actual = node.boundVariables?.[field];
        const passed = actual?.id === alias.id;
        ctx.report.validations.push({
          kind: "component-layout-binding",
          sourceId: sourceId(source),
          expected: alias.id,
          actual: actual?.id,
          passed,
          message: `${source.name}: inherited ${field} variable ${passed ? "remains bound" : "is missing or bound to a different variable"}.`
        });
        if (!passed) {
          ctx.ledger(source).mark(
            "/symbolID",
            "Partial",
            `Inherited ${field} variable binding differs from the component.`
          );
          ctx.finding(
            "COMPONENT_LAYOUT_BINDING",
            `${source.name}: inherited ${field} binding was not retained.`,
            source,
            "/symbolID"
          );
        }
      }
    }
  }

  // src/core/compound-paths.ts
  function shapeOperation(value) {
    switch (value ?? 0) {
      case -1:
        return "NONE";
      case 0:
        return "UNION";
      case 1:
        return "SUBTRACT";
      case 2:
        return "INTERSECT";
      case 3:
        return "EXCLUDE";
      default:
        throw new Error(`Unknown Sketch boolean operation: ${String(value)}`);
    }
  }
  function windingRule(value) {
    if (value === void 0 || value === 0) return "NONZERO";
    if (value === 1) return "EVENODD";
    throw new Error(`Unknown Sketch winding rule: ${String(value)}`);
  }
  function mapNetwork(network, t) {
    const at2 = (p, translate = true) => ({
      x: t[0][0] * p.x + t[0][1] * p.y + (translate ? t[0][2] : 0),
      y: t[1][0] * p.x + t[1][1] * p.y + (translate ? t[1][2] : 0)
    });
    return {
      vertices: network.vertices.map((v) => ({ ...v, ...at2(v) })),
      segments: network.segments.map((s) => ({
        ...s,
        ...s.tangentStart ? { tangentStart: at2(s.tangentStart, false) } : {},
        ...s.tangentEnd ? { tangentEnd: at2(s.tangentEnd, false) } : {}
      })),
      regions: network.regions?.map((r) => ({
        ...r,
        loops: r.loops.map((l) => [...l])
      }))
    };
  }
  function joinContours(networks, rule) {
    const vertices = [], segments = [], loops = [];
    for (const n of networks) {
      const v = vertices.length, e = segments.length;
      vertices.push(...n.vertices);
      segments.push(
        ...n.segments.map((s) => ({ ...s, start: s.start + v, end: s.end + v }))
      );
      for (const r of n.regions ?? [])
        for (const loop of r.loops) loops.push(loop.map((i2) => i2 + e));
    }
    return {
      vertices,
      segments,
      regions: loops.length ? [{ windingRule: rule, loops }] : []
    };
  }
  function filledPath(source, rule) {
    if (!source.points?.length)
      throw new Error(`${source.name}: no source contour geometry`);
    const n = vectorNetwork(source), vs = [...n.vertices], es = n.segments.map((e) => ({ ...e }));
    if (vs.length < 2)
      throw new Error(`${source.name}: degenerate compound contour`);
    const radii = source.style?.corners?.radii;
    if (radii?.length && [0, 1].includes(source.style.corners.style))
      vs.forEach((v, i2) => {
        vs[i2] = { ...v, cornerRadius: Math.max(0, radii[i2 % radii.length]) };
      });
    const first = vs[0], last = vs[vs.length - 1], repeated = first.x === last.x && first.y === last.y;
    if (repeated && !source.isClosed) {
      const tail = vs.length - 1;
      for (const e of es) if (e.end === tail) e.end = 0;
      vs.pop();
    } else if (!source.isClosed) es.push({ start: vs.length - 1, end: 0 });
    if (!es.length) throw new Error(`${source.name}: empty compound contour`);
    return {
      vertices: vs,
      segments: es,
      regions: [{ windingRule: rule, loops: [es.map((_, i2) => i2)] }]
    };
  }
  function hasImplicitClosingEdge(s) {
    if (s._class === "shapeGroup")
      return (s.layers ?? []).some(hasImplicitClosingEdge);
    if (s.isClosed || !s.points?.length) return false;
    const a = point(s.points[0].point), b = point(s.points[s.points.length - 1].point);
    return a.x !== b.x || a.y !== b.y;
  }
  function sourceContours(s, rule) {
    if (s.isVisible === false) return { vertices: [], segments: [], regions: [] };
    if (s._class === "shapeGroup") {
      if ((s.layers ?? []).slice(1).some((c) => shapeOperation(c.booleanOperation) !== "NONE"))
        throw new Error(
          `${s.name}: nested evaluated boolean requires native geometry`
        );
      if (windingRule(s.style?.windingRule) !== rule)
        throw new Error(`${s.name}: nested compound uses a different fill rule`);
      return mapNetwork(
        joinContours(
          (s.layers ?? []).map((c) => sourceContours(c, rule)),
          rule
        ),
        transform(s)
      );
    }
    return mapNetwork(filledPath(s, rule), transform(s));
  }

  // src/figma/geometry-validation.ts
  var GEOMETRY_TOLERANCE = {
    pixels: 0.1,
    degrees: 0.01,
    scale: 1e-5
  };
  function multiplyTransforms(a, b) {
    return [
      [
        a[0][0] * b[0][0] + a[0][1] * b[1][0],
        a[0][0] * b[0][1] + a[0][1] * b[1][1],
        a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2]
      ],
      [
        a[1][0] * b[0][0] + a[1][1] * b[1][0],
        a[1][0] * b[0][1] + a[1][1] * b[1][1],
        a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2]
      ]
    ];
  }
  function at(t, p) {
    return {
      x: t[0][0] * p.x + t[0][1] * p.y + t[0][2],
      y: t[1][0] * p.x + t[1][1] * p.y + t[1][2]
    };
  }
  function validPoint(p) {
    return Number.isFinite(p.x) && Number.isFinite(p.y);
  }
  function validTransform(t) {
    return t.length === 2 && t.every((row) => row.length === 3 && row.every(Number.isFinite));
  }
  function determinant(t) {
    return t[0][0] * t[1][1] - t[0][1] * t[1][0];
  }
  function angle(a, b) {
    return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180 / Math.PI;
  }
  function cubic(a, b, c, d, t) {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  }
  function extrema(a, b, c, d) {
    const A = -a + 3 * b - 3 * c + d, B = 2 * (a - 2 * b + c), C = b - a;
    if (![A, B, C].every(Number.isFinite))
      throw new Error("Nonfinite B\xE9zier coefficients");
    const epsilon = 1e-12 * Math.max(1, Math.abs(A), Math.abs(B), Math.abs(C));
    if (Math.abs(A) < epsilon)
      return Math.abs(B) < epsilon ? [] : [-C / B].filter((t) => t > 0 && t < 1);
    const discriminant = B * B - 4 * A * C;
    if (!Number.isFinite(discriminant))
      throw new Error("Nonfinite B\xE9zier discriminant");
    if (discriminant < 0) return [];
    const q = -0.5 * (B + (B < 0 ? -1 : 1) * Math.sqrt(discriminant));
    return (q === 0 ? [-B / (2 * A)] : [q / A, C / q]).filter(
      (t) => t > 0 && t < 1
    );
  }
  function networkBounds(network) {
    const vertices = network.vertices;
    if (!vertices.length || !vertices.every(validPoint))
      throw new Error("Missing or invalid vector vertices");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const include = (p) => {
      if (!validPoint(p)) throw new Error("Invalid vector coordinates");
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    };
    vertices.forEach(include);
    for (const segment of network.segments) {
      const a = vertices[segment.start], d = vertices[segment.end];
      if (!a || !d) throw new Error("Invalid vector segment indices");
      const b = {
        x: a.x + (segment.tangentStart?.x ?? 0),
        y: a.y + (segment.tangentStart?.y ?? 0)
      };
      const c = {
        x: d.x + (segment.tangentEnd?.x ?? 0),
        y: d.y + (segment.tangentEnd?.y ?? 0)
      };
      if (!validPoint(b) || !validPoint(c))
        throw new Error("Invalid B\xE9zier handles");
      for (const t of [
        ...extrema(a.x, b.x, c.x, d.x),
        ...extrema(a.y, b.y, c.y, d.y)
      ])
        include({
          x: cubic(a.x, b.x, c.x, d.x, t),
          y: cubic(a.y, b.y, c.y, d.y, t)
        });
    }
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    if (!Object.values(bounds).every(Number.isFinite))
      throw new Error("Nonfinite vector bounds");
    return bounds;
  }
  function auditGeometry(source, target, actualTransform = target.relativeTransform) {
    const id = sourceId(source), name = source.name ?? id;
    const isPath = target.type === "VECTOR" && Array.isArray(source.points) && source.points.length > 0;
    const basis = isPath ? "Unstroked path bounds before live corner rounding; stroke/effect appearance is outside this size check." : "Unrotated layer frame; strokes and effects excluded.";
    let expectedBounds, actualBounds, expectedTransform;
    try {
      const f = source.frame;
      if (!f || ![f.x, f.y, f.width, f.height].every(Number.isFinite) || f.width < 0 || f.height < 0 || source.rotation !== void 0 && !Number.isFinite(source.rotation))
        throw new Error("Invalid source frame or rotation");
      expectedTransform = transform(source);
      expectedBounds = isPath ? networkBounds(vectorNetwork(source)) : { x: 0, y: 0, width: f.width, height: f.height };
      if (isPath && !target.vectorNetwork)
        throw new Error("Native vector network could not be read");
      actualBounds = isPath ? networkBounds(target.vectorNetwork) : { x: 0, y: 0, width: target.width, height: target.height };
      if (![
        actualBounds.width,
        actualBounds.height,
        target.width,
        target.height
      ].every(Number.isFinite) || actualBounds.width < 0 || actualBounds.height < 0 || !validTransform(expectedTransform) || !validTransform(actualTransform) || !Number.isFinite(determinant(actualTransform)) || Math.abs(determinant(actualTransform)) < 1e-12)
        throw new Error("Invalid native bounds or transform");
      if (!validPoint(at(expectedTransform, expectedBounds)) || !validPoint(at(actualTransform, actualBounds)))
        throw new Error("Nonfinite placed geometry");
    } catch (error) {
      const message = `${name}: geometry comparison could not run: ${error instanceof Error ? error.message : String(error)}.`;
      return {
        dimensions: { kind: "geometry", sourceId: id, passed: null, message },
        placement: { kind: "transform", sourceId: id, passed: null, message },
        changedDimensions: [],
        changedPlacement: []
      };
    }
    const changedDimensions = ["width", "height"].filter(
      (axis) => Math.abs(expectedBounds[axis] - actualBounds[axis]) >= GEOMETRY_TOLERANCE.pixels
    );
    const expectedOrigin = at(expectedTransform, expectedBounds), actualOrigin = at(actualTransform, actualBounds);
    const sourceAxes = [
      { x: expectedTransform[0][0], y: expectedTransform[1][0] },
      { x: expectedTransform[0][1], y: expectedTransform[1][1] }
    ];
    const targetAxes = [
      { x: actualTransform[0][0], y: actualTransform[1][0] },
      { x: actualTransform[0][1], y: actualTransform[1][1] }
    ];
    const scale = targetAxes.map(
      (p, i2) => Math.hypot(p.x, p.y) / Math.hypot(sourceAxes[i2].x, sourceAxes[i2].y)
    );
    const reflected = determinant(expectedTransform) * determinant(actualTransform) < 0;
    const axisAngles = sourceAxes.map((p, i2) => angle(p, targetAxes[i2]));
    const skew = angle(targetAxes[0], targetAxes[1]) - angle(sourceAxes[0], sourceAxes[1]);
    const changedPlacement = [];
    for (const axis of ["x", "y"])
      if (Math.abs(actualOrigin[axis] - expectedOrigin[axis]) >= GEOMETRY_TOLERANCE.pixels)
        changedPlacement.push(axis);
    if (reflected) changedPlacement.push("reflection");
    else {
      if (Math.abs(axisAngles[0]) >= GEOMETRY_TOLERANCE.degrees)
        changedPlacement.push("rotation");
      if (Math.abs(skew) >= GEOMETRY_TOLERANCE.degrees)
        changedPlacement.push("skew");
    }
    if (scale.some((v) => Math.abs(v - 1) >= GEOMETRY_TOLERANCE.scale))
      changedPlacement.push("scale");
    return {
      dimensions: {
        kind: "geometry",
        sourceId: id,
        passed: !changedDimensions.length,
        expected: {
          width: expectedBounds.width,
          height: expectedBounds.height,
          basis,
          sourceFrame: source.frame,
          pathOrigin: { x: expectedBounds.x, y: expectedBounds.y },
          tolerancePx: GEOMETRY_TOLERANCE.pixels
        },
        actual: {
          width: actualBounds.width,
          height: actualBounds.height,
          nodeFrame: { width: target.width, height: target.height },
          pathOrigin: { x: actualBounds.x, y: actualBounds.y }
        },
        message: `${name}: ${changedDimensions.length ? `${changedDimensions.join(" and ")} differ by at least ${GEOMETRY_TOLERANCE.pixels}px` : `dimensions match within ${GEOMETRY_TOLERANCE.pixels}px`}. ${basis}`
      },
      placement: {
        kind: "transform",
        sourceId: id,
        passed: !changedPlacement.length,
        expected: {
          origin: expectedOrigin,
          matrix: expectedTransform,
          basis: `${isPath ? "Path bounds origin" : "Frame origin"} relative to the nearest source-bearing parent.`,
          tolerance: GEOMETRY_TOLERANCE
        },
        actual: {
          origin: actualOrigin,
          matrix: actualTransform,
          differences: changedPlacement,
          delta: {
            x: actualOrigin.x - expectedOrigin.x,
            y: actualOrigin.y - expectedOrigin.y,
            rotationDegrees: reflected ? null : axisAngles[0],
            reflection: reflected,
            scaleX: scale[0],
            scaleY: scale[1],
            skewDegrees: reflected ? null : skew
          }
        },
        message: `${name}: ${changedPlacement.length ? `placement differs in ${changedPlacement.join(", ")}` : "position and orientation match"}. Vector-origin rebasing and anonymous wrappers are accounted for; equivalent rotation/flip matrices are accepted.`
      },
      changedDimensions,
      changedPlacement
    };
  }
  function sourceRelativeTransform(node) {
    let result = node.relativeTransform, parent = node.parent;
    while (parent && parent.type !== "PAGE" && "relativeTransform" in parent && !parent.getPluginData("sketch2figma:sourceId")) {
      result = multiplyTransforms(parent.relativeTransform, result);
      parent = parent.parent;
    }
    return result;
  }

  // src/figma/booleans.ts
  var identity = [
    [1, 0, 0],
    [0, 1, 0]
  ];
  var ownerKey = "sketch2figma:shapeOwner";
  function relativeTo(node, parent) {
    let t = node.relativeTransform, p = node.parent;
    while (p && p.id !== parent.id && "relativeTransform" in p) {
      t = multiplyTransforms(p.relativeTransform, t);
      p = p.parent;
    }
    if (p?.id !== parent.id)
      throw new Error("Boolean operand is outside its source container");
    return t;
  }
  function owned(ctx, s, n, kind) {
    n.name = s.name ?? s._class;
    n.setPluginData("sketch2figma:documentId", ctx.file.documentId);
    n.setPluginData(ownerKey, sourceId(s));
    n.setPluginData("sketch2figma:wrapper", kind);
  }
  async function retire(ctx, s, parent, keep) {
    for (const n of [...parent.children]) {
      if (keep.has(n.id) || n.getPluginData("sketch2figma:sourceId")) continue;
      if (n.getPluginData("sketch2figma:documentId") !== ctx.file.documentId)
        continue;
      if (n.getPluginData(ownerKey) !== sourceId(s) && n.getPluginData("sketch2figma:wrapper") !== "boolean")
        continue;
      if ("children" in n && n.findAll((c) => !!c.getPluginData("sketch2figma:sourceId")).length)
        continue;
      await ctx.journal.before(n);
      n.visible = false;
      n.setPluginData("sketch2figma:obsolete", "true");
      ctx.cleanup.add(n);
    }
  }
  async function prepareBooleanRebuild(ctx, s, operands) {
    const containers = /* @__PURE__ */ new Map();
    for (const operand of operands) {
      let parent = operand.parent;
      while (parent && !parent.getPluginData("sketch2figma:sourceId")) {
        if ((parent.type === "BOOLEAN_OPERATION" || parent.type === "GROUP") && parent.getPluginData("sketch2figma:documentId") === ctx.file.documentId)
          containers.set(parent.id, parent);
        parent = parent.parent;
      }
    }
    for (const container of containers.values()) {
      await ctx.journal.before(container);
      const guard = ctx.api.createVector();
      ctx.journal.track(guard);
      guard.name = s.name;
      guard.visible = false;
      guard.fills = [];
      guard.strokes = [];
      container.appendChild(guard);
    }
  }
  async function resolvedNetwork(ctx, parent, operand, rule) {
    if (operand.source) {
      try {
        return sourceContours(operand.source, rule);
      } catch (error) {
        if (operand.source._class !== "shapeGroup" && operand.source.points?.length)
          throw error;
      }
    }
    const geometry = operand.source?._class === "shapeGroup" && "children" in operand.node ? operand.node.children.find(
      (n) => n.getPluginData("sketch2figma:wrapper") === "boolean" && !n.getPluginData("sketch2figma:obsolete")
    ) ?? operand.node : operand.node;
    const t = relativeTo(geometry, parent), clone = geometry.clone();
    ctx.journal.track(clone);
    parent.appendChild(clone);
    clone.relativeTransform = t;
    const clearIds = (n) => {
      n.setPluginData("sketch2figma:sourceId", "");
      if ("children" in n) for (const c of n.children) clearIds(c);
    };
    clearIds(clone);
    if ("fills" in clone && clone.type !== "FRAME")
      clone.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    if ("strokes" in clone) clone.strokes = [];
    if ("effects" in clone) clone.effects = [];
    if ("opacity" in clone) clone.opacity = 1;
    const vector = ctx.api.flatten([clone], parent);
    ctx.journal.track(vector);
    try {
      const network = vector.vectorNetwork;
      if ((network.regions ?? []).some((r) => r.windingRule !== "NONZERO"))
        throw new Error(
          "Native resolved contours do not expose a compatible nonzero winding representation"
        );
      return mapNetwork(network, relativeTo(vector, parent));
    } finally {
      vector.remove();
    }
  }
  async function compound(ctx, s, parent, operands, rule) {
    const networks = [];
    for (const o of operands) {
      if (ctx.cancelled) throw new Error("IMPORT_CANCELLED");
      networks.push(await resolvedNetwork(ctx, parent, o, rule));
    }
    const network = joinContours(networks, rule), result = ctx.api.createVector();
    ctx.journal.track(result);
    parent.appendChild(result);
    owned(ctx, s, result, "boolean");
    result.setPluginData("sketch2figma:shapeRepresentation", "compound");
    result.setPluginData(
      "sketch2figma:contourSources",
      JSON.stringify(
        operands.map(
          (o) => o.source ? sourceId(o.source) : o.node.getPluginData("sketch2figma:contourSources")
        )
      )
    );
    if (network.vertices.length) {
      const bounds = networkBounds(network);
      await result.setVectorNetworkAsync(
        mapNetwork(network, [
          [1, 0, -bounds.x],
          [0, 1, -bounds.y]
        ])
      );
      const nativeBounds = networkBounds(result.vectorNetwork);
      result.relativeTransform = [
        [1, 0, bounds.x - nativeBounds.x],
        [0, 1, bounds.y - nativeBounds.y]
      ];
    } else {
      await result.setVectorNetworkAsync(network);
      result.visible = false;
    }
    const originals = ctx.api.createFrame();
    ctx.journal.track(originals);
    parent.appendChild(originals);
    owned(ctx, s, originals, "compound-sources");
    originals.fills = [];
    originals.clipsContent = false;
    originals.visible = false;
    originals.resize(Math.max(0.01, parent.width), Math.max(0.01, parent.height));
    originals.relativeTransform = identity;
    for (const o of operands) {
      await ctx.journal.before(o.node);
      const t = relativeTo(o.node, parent);
      originals.appendChild(o.node);
      o.node.relativeTransform = t;
    }
    const reason = "Editable compound vector uses the source fill rule. Original contour layers and IDs are retained in a hidden container; editing those retained operands does not update the rendered compound automatically.";
    ctx.ledger(s).mark("/_class", "Editable Equivalent", reason);
    ctx.finding("COMPOUND_EDITABILITY", reason, s, "/layers", "info");
    for (const o of operands)
      if (o.source)
        ctx.ledger(o.source).mark("/booleanOperation", "Editable Equivalent", reason);
    if (operands.some((o) => o.source && hasImplicitClosingEdge(o.source)) && (s.style?.borders ?? []).some((b) => b.isEnabled !== false)) {
      ctx.finding(
        "COMPOUND_OPEN_STROKE",
        "Implicit fill closure is native, but a compound's open-path border may include the closing edge. Original open contour geometry is retained.",
        s,
        "/style/borders"
      );
      ctx.ledger(s).mark(
        "/_class",
        "Partial",
        "Open-path compound border closure differs; see COMPOUND_OPEN_STROKE."
      );
    }
    return result;
  }
  async function operativeGeometry(ctx, node, source) {
    if (node.type === "VECTOR" && node.vectorNetwork.regions?.some((r) => r.windingRule !== "EVENODD")) {
      await ctx.journal.before(node);
      const network = node.vectorNetwork;
      await node.setVectorNetworkAsync({
        ...network,
        regions: network.regions.map((r) => ({ ...r, windingRule: "EVENODD" }))
      });
      if (source) {
        const reason = "Operand contours use parity for native boolean evaluation, matching Sketch's boolean clipping. The original standalone fill rule is retained in source metadata.";
        ctx.ledger(source).mark("/style/windingRule", "Editable Equivalent", reason);
        ctx.finding(
          "BOOLEAN_OPERAND_WINDING",
          reason,
          source,
          "/style/windingRule",
          "info"
        );
      }
    }
    if (!("fills" in node) || typeof node.fills === "symbol") return;
    const filled = node.fills.some((paint2) => paint2.visible !== false), stroked = "strokes" in node && node.strokes.some((paint2) => paint2.visible !== false);
    if (filled || stroked) return;
    await ctx.journal.before(node);
    node.fills = [...node.fills, { type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    node.setPluginData("sketch2figma:booleanGeometryFill", "true");
    if (source) {
      const reason = "Unpainted Sketch operand receives an internal geometry fill for native boolean evaluation; the combined shape owns the visible paint. Original paint definitions remain in source metadata.";
      ctx.ledger(source).mark("/style/fills", "Editable Equivalent", reason);
      ctx.finding(
        "BOOLEAN_GEOMETRY_FILL",
        reason,
        source,
        "/style/fills",
        "info"
      );
    }
  }
  async function nativeOperand(ctx, owner, parent, operand) {
    const node = operand.node;
    if (!["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) return node;
    const renderer = operand.source?._class === "shapeGroup" && "children" in node ? node.children.find(
      (c) => c.getPluginData("sketch2figma:wrapper") === "boolean" && !c.getPluginData("sketch2figma:obsolete")
    ) : void 0;
    const transform2 = relativeTo(renderer ?? node, parent);
    let copy = (renderer ?? node).clone();
    ctx.journal.track(copy);
    parent.appendChild(copy);
    copy.relativeTransform = transform2;
    const clearIds = (n) => {
      n.setPluginData("sketch2figma:sourceId", "");
      if ("children" in n) for (const child of n.children) clearIds(child);
    };
    clearIds(copy);
    if (!renderer) {
      copy = ctx.api.flatten([copy], parent);
      ctx.journal.track(copy);
      clearIds(copy);
    }
    copy.setPluginData(
      "sketch2figma:operandSource",
      operand.source ? sourceId(operand.source) : node.getPluginData("sketch2figma:operandSource")
    );
    owned(ctx, operand.source ?? owner, copy, "boolean-operand");
    const originals = ctx.api.createFrame();
    ctx.journal.track(originals);
    parent.appendChild(originals);
    owned(ctx, owner, originals, "boolean-sources");
    originals.fills = [];
    originals.clipsContent = false;
    originals.visible = false;
    originals.resize(Math.max(0.01, parent.width), Math.max(0.01, parent.height));
    originals.relativeTransform = identity;
    await ctx.journal.before(node);
    const position = relativeTo(node, parent);
    originals.appendChild(node);
    node.relativeTransform = position;
    if (operand.source) {
      const reason = "Frame or nested combined shape uses an editable geometry copy as the boolean operand. The complete original source subtree is retained in a hidden container; editing that retained subtree does not update the operative copy live.";
      ctx.ledger(operand.source).mark("/_class", "Editable Equivalent", reason);
      ctx.finding(
        "BOOLEAN_OPERAND_COPY",
        reason,
        operand.source,
        "/layers",
        "info"
      );
    }
    return copy;
  }
  async function combine(ctx, s, parent, left, right, op) {
    await operativeGeometry(ctx, left);
    await operativeGeometry(ctx, right);
    parent.appendChild(left);
    parent.appendChild(right);
    const result = op === "SUBTRACT" ? ctx.api.subtract([left, right], parent) : op === "INTERSECT" ? ctx.api.intersect([left, right], parent) : op === "EXCLUDE" ? ctx.api.exclude([left, right], parent) : ctx.api.union([left, right], parent);
    ctx.journal.track(result);
    owned(ctx, s, result, "boolean-step");
    if (result.booleanOperation !== op)
      throw new Error(
        `Figma boolean readback was ${result.booleanOperation}, expected ${op}`
      );
    return result;
  }
  async function applyBooleanShape(ctx, s, parent) {
    const layers = s.layers ?? [], rule = windingRule(s.style?.windingRule);
    for (const child of layers) shapeOperation(child.booleanOperation);
    const operands = layers.map((source) => ({
      source,
      node: ctx.nodes.get(sourceId(source))
    }));
    if (operands.some((o) => !o.node))
      throw new Error(`${s.name}: boolean operand missing from import`);
    const active = operands.filter(
      (o) => o.source.isVisible !== false
    );
    if (active[0])
      ctx.ledger(active[0].source).mark(
        "/booleanOperation",
        "Native",
        "The first operand supplies base geometry; its operator has no preceding operand."
      );
    let result, pendingBase;
    let pending = [];
    const flush = async () => {
      if (!pending.length) return;
      pendingBase = pending.length === 1 && !result ? pending[0].source : void 0;
      result = pending.length === 1 && !result ? pending[0].node : await compound(ctx, s, parent, pending, rule);
      pending = [];
    };
    for (const o of active) {
      if (ctx.cancelled) throw new Error("IMPORT_CANCELLED");
      if (!result && !pending.length) {
        pending.push(o);
        continue;
      }
      const op = shapeOperation(o.source.booleanOperation);
      if (op === "NONE") {
        if (pending.length) pending.push(o);
        else if (result && rule === "EVENODD") {
          const contour = await compound(ctx, s, parent, [o], rule);
          result = await combine(ctx, s, parent, result, contour, "EXCLUDE");
        } else if (result) pending = [{ node: result }, o];
      } else {
        await flush();
        if (result) {
          const base = await nativeOperand(ctx, s, parent, {
            node: result,
            source: pendingBase
          }), right = await nativeOperand(ctx, s, parent, o);
          await operativeGeometry(ctx, base, pendingBase);
          await operativeGeometry(ctx, right, o.source);
          result = await combine(ctx, s, parent, base, right, op);
          pendingBase = void 0;
        }
        ctx.ledger(o.source).mark("/booleanOperation");
      }
    }
    await flush();
    if (active.length === 1)
      result = await compound(ctx, s, parent, [active[0]], rule);
    if (result) {
      const width = Math.max(0.01, finite(s.frame?.width, 1)), height = Math.max(0.01, finite(s.frame?.height, 1));
      const t = relativeTo(result, parent);
      await applyAppearance(ctx, s, result, {
        width,
        height,
        transform: [
          [
            t[0][0] * result.width / width,
            t[0][1] * result.height / width,
            t[0][2] / width
          ],
          [
            t[1][0] * result.width / height,
            t[1][1] * result.height / height,
            t[1][2] / height
          ]
        ]
      });
      owned(ctx, s, result, "boolean");
      if (result.type === "BOOLEAN_OPERATION")
        ctx.ledger(s).mark(
          "/_class",
          "Editable Equivalent",
          "Live native boolean operations inside the source-bounds frame; original operands retained."
        );
    } else
      ctx.ledger(s).mark(
        "/_class",
        "Editable Equivalent",
        "Empty or hidden source shape operands retained without adding visible geometry."
      );
    parent.fills = [];
    parent.strokes = [];
    parent.effects = [];
    ctx.ledger(s).mark("/style/windingRule");
    const keep = new Set(
      parent.children.filter(
        (n) => n.id === result?.id || n.getPluginData(ownerKey) === sourceId(s) && !n.getPluginData("sketch2figma:obsolete") && "children" in n && n.findAll((c) => !!c.getPluginData("sketch2figma:sourceId")).length
      ).map((n) => n.id)
    );
    await retire(ctx, s, parent, keep);
  }
  function validateBooleanShape(ctx, s, parent) {
    if (!("children" in parent)) return;
    const active = (s.layers ?? []).filter(
      (c) => c.isVisible !== false
    );
    const result = parent.children.find(
      (c) => c.getPluginData("sketch2figma:wrapper") === "boolean" && !c.getPluginData("sketch2figma:obsolete")
    );
    const pure = active.slice(1).every((c) => shapeOperation(c.booleanOperation) === "NONE") && active.length > 1 || active.length === 1;
    let passed = !!result || !active.length, expected, actual;
    if (pure) {
      const rule = windingRule(s.style?.windingRule);
      expected = {
        representation: "compound",
        windingRule: rule,
        sourceOperands: active.length
      };
      actual = result?.type === "VECTOR" ? {
        representation: "compound",
        windingRule: result.vectorNetwork.regions?.[0]?.windingRule,
        contours: result.vectorNetwork.regions?.reduce(
          (n, r) => n + r.loops.length,
          0
        )
      } : { representation: result?.type };
      if (result?.type !== "VECTOR") passed = false;
      else {
        try {
          const network = joinContours(
            active.map((c) => sourceContours(c, rule)),
            rule
          );
          const native = mapNetwork(
            result.vectorNetwork,
            relativeTo(result, parent)
          );
          expected = {
            ...expected,
            contours: network.regions?.reduce((n, r) => n + r.loops.length, 0)
          };
          passed = contoursEquivalent(network, native);
        } catch (error) {
          passed = null;
          actual = { ...actual, reason: String(error) };
        }
      }
    } else if (result) {
      const operations = [], leaves2 = [];
      const visit = (n) => {
        const id = n.getPluginData("sketch2figma:operandSource") || n.getPluginData("sketch2figma:sourceId");
        if (id) {
          leaves2.push(id);
          return;
        }
        if (n.type === "BOOLEAN_OPERATION") {
          for (const c of n.children) visit(c);
          operations.push(n.booleanOperation);
        } else if (n.type === "VECTOR") {
          const ids = JSON.parse(
            n.getPluginData("sketch2figma:contourSources") || "[]"
          );
          leaves2.push(...ids);
        }
      };
      visit(result);
      const explicit = active.slice(1).map((c) => shapeOperation(c.booleanOperation)).filter((op) => op !== "NONE");
      const mixedNone = active.slice(1).some((c) => shapeOperation(c.booleanOperation) === "NONE");
      expected = { operations: explicit, operands: active.map(sourceId) };
      actual = { operations, operands: leaves2 };
      passed = mixedNone ? null : JSON.stringify(expected) === JSON.stringify(actual);
    }
    ctx.report.validations.push({
      kind: "boolean-geometry",
      sourceId: sourceId(s),
      expected,
      actual,
      passed,
      message: `${s.name}: ${passed === null ? "compound geometry could not be compared or mixed operators require native render comparison" : passed ? "compound contours or boolean sequence match native readback" : "compound contours or boolean sequence differ from source"}.`
    });
    if (passed === false) {
      ctx.ledger(s).mark(
        "/_class",
        "Partial",
        "Boolean geometry readback differs from source."
      );
      ctx.finding(
        "BOOLEAN_DIFFERENCE",
        "Compound contours or native boolean sequence differ from source.",
        s,
        "/layers",
        "error"
      );
    }
  }
  function contourCurves(network, loop) {
    return loop.map((index, i2) => {
      const e = network.segments[index], next = network.segments[loop[(i2 + 1) % loop.length]];
      if (!e || !next) throw new Error("Invalid compound segment indices");
      const forward = loop.length === 1 || e.end === next.start || e.end === next.end;
      const a = network.vertices[forward ? e.start : e.end], b = network.vertices[forward ? e.end : e.start], from = forward ? e.tangentStart : e.tangentEnd, to = forward ? e.tangentEnd : e.tangentStart;
      if (!a || !b) throw new Error("Invalid compound vertex indices");
      return [
        a.x,
        a.y,
        a.x + (from?.x ?? 0),
        a.y + (from?.y ?? 0),
        b.x + (to?.x ?? 0),
        b.y + (to?.y ?? 0),
        b.x,
        b.y,
        a.cornerRadius ?? 0,
        b.cornerRadius ?? 0
      ];
    });
  }
  function reverseContour(loop) {
    return [...loop].reverse().map((c) => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1], c[9], c[8]]);
  }
  function sameContour(a, b) {
    if (a.length !== b.length) return false;
    return b.some(
      (_, offset) => a.every(
        (curve, i2) => curve.every((value, j) => {
          const actual = b[(offset + i2) % b.length][j];
          return Number.isFinite(value) && Number.isFinite(actual) && Math.abs(value - actual) < GEOMETRY_TOLERANCE.pixels;
        })
      )
    );
  }
  function sameLoops(expected, actual, allowReverse) {
    if (expected.length !== actual.length) return false;
    const remaining = [...actual];
    return expected.every((loop) => {
      const i2 = remaining.findIndex(
        (other) => sameContour(loop, other) || allowReverse && sameContour(loop, reverseContour(other))
      );
      if (i2 < 0) return false;
      remaining.splice(i2, 1);
      return true;
    });
  }
  function contoursEquivalent(expected, actual) {
    const a = expected.regions ?? [], b = actual.regions ?? [];
    if (a.length !== b.length) return false;
    return a.every((region, i2) => {
      const other = b[i2];
      if (region.windingRule !== other.windingRule) return false;
      const sourceLoops = region.loops.map(
        (loop) => contourCurves(expected, loop)
      ), nativeLoops = other.loops.map((loop) => contourCurves(actual, loop));
      return sameLoops(sourceLoops, nativeLoops, region.windingRule === "EVENODD") || region.windingRule === "NONZERO" && sameLoops(sourceLoops, nativeLoops.map(reverseContour), false);
    });
  }

  // src/figma/validation.ts
  async function validateImport(ctx, scope) {
    const parents = /* @__PURE__ */ new Map();
    for (const p of walkLayers(ctx.file.pages))
      for (const c of p.layers ?? []) parents.set(sourceId(c), p);
    const checks = ctx.report.validations, all = walkLayers(ctx.file.pages).filter(
      (s) => scope.has(sourceId(s)) && s._class !== "page"
    );
    for (const s of all) {
      const id = sourceId(s), n = ctx.nodes.get(id);
      checks.push({
        kind: "layer-exists",
        sourceId: id,
        passed: !!n && !n.removed,
        message: `${s.name}: ${n && !n.removed ? "source node has a Figma mapping" : "source node is missing from Figma"}.`
      });
      if (!n || n.removed) continue;
      await validateDetails(ctx, s, n);
      if (s._class === "shapeGroup") validateBooleanShape(ctx, s, n);
      const geometry = auditGeometry(s, n, sourceRelativeTransform(n));
      checks.push(geometry.dimensions, geometry.placement);
      if (geometry.dimensions.passed === null || geometry.placement.passed === null) {
        const reason = geometry.dimensions.message;
        ctx.ledger(s).fields("/frame", ["width", "height", "x", "y"], "Partial", reason);
        ctx.ledger(s).fields(
          "",
          ["rotation", "isFlippedHorizontal", "isFlippedVertical"],
          "Partial",
          reason
        );
        ctx.finding("GEOMETRY_UNVERIFIED", reason, s, "/frame");
      }
      if (geometry.changedDimensions.length) {
        ctx.ledger(s).fields(
          "/frame",
          geometry.changedDimensions,
          "Partial",
          geometry.dimensions.message
        );
        ctx.finding(
          "GEOMETRY_DIFFERENCE",
          geometry.dimensions.message,
          s,
          "/frame"
        );
      }
      if (geometry.changedPlacement.length) {
        const changed = geometry.changedPlacement, reason = geometry.placement.message;
        ctx.ledger(s).fields(
          "/frame",
          changed.filter((field) => field === "x" || field === "y"),
          "Partial",
          reason
        );
        if (changed.includes("rotation") || changed.includes("skew"))
          ctx.ledger(s).mark("/rotation", "Partial", reason);
        if (changed.includes("reflection"))
          ctx.ledger(s).fields(
            "",
            ["isFlippedHorizontal", "isFlippedVertical"],
            "Partial",
            reason
          );
        if (changed.includes("scale"))
          ctx.ledger(s).fields("/frame", ["width", "height"], "Partial", reason);
        ctx.finding("TRANSFORM_DIFFERENCE", reason, s, "/frame");
      }
      const sourceParent = parents.get(id);
      let targetParent = n.parent;
      while (targetParent && targetParent.type !== "PAGE" && !targetParent.getPluginData("sketch2figma:sourceId"))
        targetParent = targetParent.parent;
      checks.push({
        kind: "hierarchy",
        sourceId: id,
        passed: targetParent?.getPluginData("sketch2figma:sourceId") === sourceId(sourceParent ?? {}),
        expected: sourceId(sourceParent ?? {}),
        actual: targetParent?.getPluginData("sketch2figma:sourceId"),
        message: `${s.name}: nearest source-bearing parent ${targetParent?.getPluginData("sketch2figma:sourceId") === sourceId(sourceParent ?? {}) ? "matches" : "differs from"} the source parent.`
      });
      if (s._class === "text")
        checks.push({
          kind: "text-content",
          sourceId: id,
          passed: "characters" in n && n.characters === s.attributedString?.string,
          expected: s.attributedString?.string,
          actual: "characters" in n ? n.characters : null,
          message: `${s.name}: editable UTF-16 text ${"characters" in n && n.characters === s.attributedString?.string ? "is preserved" : "differs or is missing"}.`
        });
      if (s._class === "symbolInstance") {
        const master = n.type === "INSTANCE" ? await n.getMainComponentAsync() : null;
        const expectedComponent = ctx.resources.components.get(
          String(s.symbolID)
        );
        const linked = !!master && !!expectedComponent && master.id === expectedComponent.id;
        checks.push({
          kind: "component-link",
          sourceId: id,
          passed: linked,
          expected: expectedComponent?.id ?? String(s.symbolID),
          actual: master?.id,
          message: `${s.name}: ${linked ? "linked to the resolved component" : "component link differs or is missing"}.`
        });
      }
      const appearance = s._class === "shapeGroup" && "children" in n ? n.children.find(
        (child) => child.getPluginData("sketch2figma:wrapper") === "boolean" && !child.getPluginData("sketch2figma:obsolete")
      ) ?? n : n;
      if (s.sharedStyleID) {
        const id2 = s.sharedStyleID;
        for (const [resource, field] of [
          [ctx.resources.texts.get(id2), "textStyleId"],
          [ctx.resources.effects.get(id2), "effectStyleId"]
        ]) {
          if (!resource) continue;
          const value = appearance[field];
          const passed = field === "textStyleId" && n.type === "TEXT" ? await isTextStyleBound(ctx, id2, n) : value === resource.id;
          if (!passed) {
            ctx.ledger(s).mark(
              "/sharedStyleID",
              "Partial",
              `${field} is not fully bound in the native host; see binding validation.`
            );
            ctx.finding(
              "STYLE_BINDING_DIFFERENCE",
              `${s.name}: ${field} lost part or all of the source binding.`,
              s,
              "/sharedStyleID",
              "warning",
              field === "textStyleId" ? "textStyles" : "layerStyles"
            );
          }
          checks.push({
            kind: "style-binding",
            resource: field === "textStyleId" ? "textStyles" : "layerStyles",
            sourceId: sourceId(s),
            passed,
            expected: resource.id,
            actual: typeof value === "symbol" ? "mixed" : value,
            message: `${s.name}: ${field} ${passed ? "remains bound to its original source resource" : "is not fully bound to its original source resource"}.`
          });
        }
        if (![
          ctx.resources.texts,
          ctx.resources.paints,
          ctx.resources.strokes,
          ctx.resources.effects
        ].some((m) => m.has(id2)))
          checks.push({
            kind: "style-binding",
            sourceId: sourceId(s),
            resource: s._class === "text" ? "textStyles" : "layerStyles",
            passed: false,
            expected: id2,
            message: `${s.name}: shared style is unresolved.`
          });
      }
      validateColorBindings(ctx, s, appearance);
      if (n.type === "INSTANCE") {
        await validateOverrides(ctx, s, n);
        await validateInstanceTextStyles(ctx, s, n);
      }
      if (s.flow && "reactions" in n) {
        checks.push({
          kind: "prototype",
          sourceId: id,
          passed: n.reactions.length > 0,
          message: `${s.name}: source prototype link ${n.reactions.length ? "has an active reaction" : "has no active reaction"} (generated arrangements are reported separately).`
        });
      }
    }
    const failedSizes = new Map(
      checks.filter((v) => v.kind === "geometry" && v.passed === false).map((v) => [v.sourceId, v])
    );
    for (const s of all) {
      const check = failedSizes.get(sourceId(s)), node = ctx.nodes.get(sourceId(s));
      if (!check || !node || !("layoutMode" in node) || node.layoutMode === "NONE")
        continue;
      const hugWidth = node.layoutSizingHorizontal === "HUG", hugHeight = node.layoutSizingVertical === "HUG";
      if (!hugWidth && !hugHeight) continue;
      const related = (s.layers ?? []).filter((child) => {
        const mismatch = failedSizes.get(sourceId(child));
        if (!mismatch) return false;
        const expected = mismatch.expected, actual = mismatch.actual;
        return hugWidth && Math.abs(expected.width - actual.width) >= GEOMETRY_TOLERANCE.pixels || hugHeight && Math.abs(expected.height - actual.height) >= GEOMETRY_TOLERANCE.pixels;
      });
      if (related.length)
        check.message += ` Auto Layout hugs ${[hugWidth && "width", hugHeight && "height"].filter(Boolean).join(" and ")}; related child size differences: ${related.map((child) => child.name ?? sourceId(child)).join(", ")}. These checks may be related; no independent cause is inferred.`;
    }
    const mappedCount = all.filter((s) => {
      const node = ctx.nodes.get(sourceId(s));
      return !!node && !node.removed;
    }).length;
    checks.push({
      kind: "layer-count",
      passed: mappedCount === all.length,
      expected: all.length,
      actual: mappedCount,
      message: `${mappedCount} of ${all.length} selected source layers have live mappings; dependency and mask wrapper counts are separate.`
    });
    checks.push({
      kind: "visual-pixels",
      passed: null,
      message: "Not run: requires an actual Sketch reference render. Native API success is not visual-fidelity proof."
    });
    checks.push({
      kind: "responsive-layout",
      passed: null,
      message: "Source resize baselines are required to compare responsive behavior at multiple sizes."
    });
  }
  function validateColorBindings(ctx, s, n) {
    const check = (color, actual, path) => {
      if (!color?.swatchID) return;
      const expected = ctx.resources.variables.get(color.swatchID)?.id;
      ctx.report.validations.push({
        kind: "variable-binding",
        sourceId: sourceId(s),
        passed: !!expected && actual?.id === expected,
        expected,
        actual: actual?.id,
        message: `${s.name}: ${path} ${expected && actual?.id === expected ? "retains its color-variable binding" : "has a missing or different color-variable binding"}.`
      });
    };
    for (const [key, field] of [
      ["fills", "fills"],
      ["borders", "strokes"]
    ]) {
      if (!(field in n)) continue;
      const paints = n[field];
      if (typeof paints === "symbol") continue;
      for (const [i2, fill] of (s.style?.[key] ?? []).entries()) {
        const p = paints?.[i2];
        if (fill.fillType === 0 || fill.fillType === void 0)
          check(
            fill.color,
            p?.boundVariables?.color ?? (p?.gradientStops?.length === 2 && p.gradientStops.every(
              (stop) => stop.boundVariables?.color?.id === p.gradientStops[0].boundVariables?.color?.id
            ) ? p.gradientStops[0].boundVariables?.color : void 0),
            `${key}/${i2}`
          );
        else if (fill.fillType === 1)
          for (const [j, stop] of (fill.gradient?.stops ?? []).entries())
            check(
              stop.color,
              p?.gradientStops?.[j]?.boundVariables?.color,
              `${key}/${i2}/gradient/${j}`
            );
      }
    }
    if ("effects" in n) {
      let offset = 0;
      for (const key of ["shadows", "innerShadows"])
        for (const effect of s.style?.[key] ?? []) {
          const target = n.effects[offset++];
          check(
            effect.color,
            target && (target.type === "DROP_SHADOW" || target.type === "INNER_SHADOW") ? target.boundVariables?.color : void 0,
            key
          );
        }
    }
    if (n.type === "TEXT") {
      const base = s.style?.textStyle?.encodedAttributes?.MSAttributedStringColorAttribute;
      const get = (a, b) => {
        const fills = n.getRangeFills(a, b);
        return typeof fills === "symbol" ? void 0 : fills[0]?.type === "SOLID" ? fills[0].boundVariables?.color : void 0;
      };
      if (n.characters.length && !(s.style?.fills ?? []).some((f) => f.isEnabled !== false)) {
        const runs = s.attributedString?.attributes ?? [];
        if (!runs.length) check(base, get(0, n.characters.length), "text color");
        for (const r of runs)
          if (r.length > 0 && r.location >= 0 && r.location + r.length <= n.characters.length)
            check(
              r.attributes?.MSAttributedStringColorAttribute ?? base,
              get(r.location, r.location + r.length),
              "text run color"
            );
      }
    }
  }
  async function validateOverrides(ctx, s, n) {
    for (const o of s.overrideValues ?? []) {
      const m = String(o.overrideName).match(/^(.*)_([^_]+)$/);
      if (!m) continue;
      const target = overrideTarget(n, m[1].split("/"));
      let passed;
      if (m[2] === "stringValue")
        passed = !!target && "characters" in target && target.characters === String(o.value);
      if (m[2] === "isVisible")
        passed = target?.visible === (o.value !== false && o.value !== 0 && o.value !== "0");
      if (m[2] === "symbolID")
        passed = o.value === "" ? target?.visible === false : !!ctx.resources.components.get(String(o.value)) && target?.type === "INSTANCE" && (await target.getMainComponentAsync())?.id === ctx.resources.components.get(String(o.value))?.id;
      if (passed !== void 0)
        ctx.report.validations.push({
          kind: "component-override",
          sourceId: sourceId(s),
          passed,
          expected: o.value,
          actual: !target ? null : m[2] === "stringValue" && "characters" in target ? target.characters : m[2] === "isVisible" ? target.visible : target.type === "INSTANCE" ? (await target.getMainComponentAsync())?.getPluginData(
            "sketch2figma:sourceId"
          ) : null,
          message: `${s.name}: ${o.overrideName} ${passed ? "matches" : "differs from"} the source override.`
        });
    }
  }
  async function validateInstanceTextStyles(ctx, source, instance) {
    for (const { node, source: original } of instanceTextSources(
      instance,
      source
    )) {
      const sourceStyleId = original.sharedStyleID;
      if (!sourceStyleId) continue;
      const ranges = node.getStyledTextSegments(["textStyleId"]);
      const passed = await isTextStyleBound(ctx, sourceStyleId, node);
      ctx.report.validations.push({
        kind: "instance-text-style-binding",
        sourceId: sourceId(source),
        expected: {
          sourceTextId: sourceId(original),
          sourceStyleId,
          styleId: ctx.resources.texts.get(sourceStyleId)?.id
        },
        actual: {
          targetId: node.id,
          ranges: ranges.map(({ start, end, textStyleId }) => ({
            start,
            end,
            textStyleId
          })),
          emptyTextStyleId: node.characters.length ? void 0 : typeof node.textStyleId === "symbol" ? "mixed" : node.textStyleId
        },
        passed,
        message: `${source.name} / ${node.name}: instance text ${passed ? "is bound" : "is not fully bound"} to its effective original source style.`
      });
      if (!passed) {
        ctx.finding(
          "INSTANCE_TEXT_STYLE_BINDING",
          `${source.name} / ${node.name}: one or more text ranges are not bound to source style ${sourceStyleId} with its exact source overrides.`,
          source,
          "/symbolID"
        );
        ctx.ledger(source).mark(
          "/symbolID",
          "Partial",
          "Native component link exists, but instance text has unbound source style ranges; see instance-text-style-binding checks."
        );
      }
    }
  }

  // src/figma/importer.ts
  function startImport(api, input, options = DEFAULT_OPTIONS, libraries = [], progress = () => {
  }) {
    let ctx, cancelled = false;
    const result = (async () => {
      await api.loadAllPagesAsync();
      const prior = readData(api.root, "journal", null);
      if (prior) {
        const errors = await recover(api, prior);
        if (errors.length)
          throw new Error(`Recovery required: ${errors.join("; ")}`);
      }
      const file = withLibraries(input, libraries), index = readIndex(api, file.documentId), journal = new Journal(api, index);
      const report = {
        schemaVersion: 1,
        file: file.name,
        documentId: file.documentId,
        sourceVersion: file.version,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        state: "running",
        layers: [],
        findings: [...file.warnings],
        validations: [],
        totals: {
          Native: 0,
          "Editable Equivalent": 0,
          "Visual Equivalent": 0,
          Partial: 0,
          Unsupported: 0
        },
        created: 0,
        reused: 0,
        updated: 0,
        preserved: 0,
        visualValidation: "not-run",
        apiVersion: api.apiVersion,
        sourceMetadataPreserved: false
      };
      ctx = new ImportContext(
        api,
        file,
        options,
        report,
        index,
        journal,
        progress
      );
      ctx.cancelled = cancelled;
      const c = ctx;
      const plan = resourceSelection(file, options);
      c.resourceSelection = plan;
      const scope = plan.scope, available = masters(file), needed = plan.symbols, mutable = /* @__PURE__ */ new Set();
      const sourceById = new Map(
        walkLayers(file.pages).map((s) => [sourceId(s), s])
      );
      for (const master of available.values())
        for (const s of walkLayers([master])) sourceById.set(sourceId(s), s);
      const parentSources = /* @__PURE__ */ new Map();
      for (const p of walkLayers(file.pages))
        for (const child of p.layers ?? []) parentSources.set(sourceId(child), p);
      const preservedIds = /* @__PURE__ */ new Set();
      const initialTarget = /* @__PURE__ */ new Map();
      for (const [id, m] of Object.entries(index.nodes)) {
        const n = await api.getNodeByIdAsync(m.nodeId);
        if (n && "visible" in n)
          initialTarget.set(
            id,
            await targetFingerprint(n, m.targetHashVersion ?? 1)
          );
      }
      let resourcePage;
      const pages = /* @__PURE__ */ new Map();
      async function pageFor(p) {
        const id = sourceId(p);
        if (pages.has(id)) return pages.get(id);
        let page;
        const mapped = options.destinationPageId ?? index.pages[id];
        if (mapped) {
          const n = await api.getNodeByIdAsync(mapped);
          if (n?.type === "PAGE") page = n;
        }
        if (!page) {
          page = api.createPage();
          journal.track(page);
          page.name = p.name;
          report.created++;
        } else if (options.destinationPageId)
          ctx.finding(
            "DESTINATION_PAGE",
            "Imported source page mapped into the chosen destination page.",
            p,
            void 0,
            "info"
          );
        journal.beforePage(page);
        if (!options.destinationPageId) {
          page.name = p.name;
          page.setPluginData("sketch2figma:sourceId", id);
        }
        index.pages[id] = page.id;
        pages.set(id, page);
        const l = c.ledger(p);
        l.result.targetId = page.id;
        l.fields("", ["_class", "do_objectID", "name"]);
        await applyGuidesGrids(c, p, page);
        page.setPluginData("sketch2figma:documentId", file.documentId);
        writeData(page, "source", ownSource(p));
        return page;
      }
      async function resourcesPage() {
        if (resourcePage) return resourcePage;
        const old = index.pages.__resources;
        if (old) {
          const n = await api.getNodeByIdAsync(old);
          if (n?.type === "PAGE") resourcePage = n;
        }
        if (!resourcePage) {
          resourcePage = api.createPage();
          journal.track(resourcePage);
          resourcePage.name = `${file.name} / Components`;
          index.pages.__resources = resourcePage.id;
        }
        return resourcePage;
      }
      async function existing(s) {
        const record = index.nodes[sourceId(s)];
        if (!record) return void 0;
        const n = await api.getNodeByIdAsync(record.nodeId);
        return n && "visible" in n ? n : void 0;
      }
      function restoreAudits(s, node, local = false) {
        for (const source of walkLayers([s])) {
          const old = index.nodes[sourceId(source)];
          const n = c.nodes.get(sourceId(source));
          const ledger = c.ledger(source);
          const saved = n ? readData(n, "audit", null) : null;
          if (saved) {
            ledger.result.properties = saved.properties;
            for (const p of saved.properties)
              ledger.mark(
                p.path,
                local ? "Partial" : p.status,
                local ? "Local Figma edits preserved; source value was not reapplied." : p.reason
              );
          }
          ledger.result.targetId = n?.id ?? old?.nodeId;
        }
        if (local)
          c.finding(
            "LOCAL_CONFLICT",
            `${s.name}: locally modified subtree preserved.`,
            s
          );
      }
      async function hydrate(s) {
        for (const source of walkLayers([s])) {
          const n = await existing(source);
          if (n) c.nodes.set(sourceId(source), n);
          c.processed.add(sourceId(source));
        }
      }
      async function build(s, parent, dependency = false) {
        const id = sourceId(s);
        if (c.processed.has(id) && c.nodes.has(id)) return c.nodes.get(id);
        await c.tick(s);
        let node = await existing(s);
        const old = index.nodes[id];
        const fresh = !node;
        if (node && old) {
          const hash = fingerprint(s), target = initialTarget.get(id) ?? await targetFingerprint(node, old.targetHashVersion ?? 1), local = target !== old.targetHash, complete = walkLayers([s]).filter(
            (child) => dependency || s._class === "symbolMaster" || scope.has(sourceId(child))
          ).every((child) => initialTarget.has(sourceId(child)));
          if (hash === old.sourceHash && old.conversionHash === c.conversionHash && !local && complete || local && options.conflict === "preserve-local") {
            await hydrate(s);
            restoreAudits(s, node, local);
            if (local) {
              report.preserved++;
              for (const child of walkLayers([s]))
                preservedIds.add(sourceId(child));
            } else {
              report.reused++;
              await journal.before(node);
              const carrier = node.parent?.type === "FRAME" && node.parent.getPluginData("sketch2figma:fadeFor") === id ? node.parent : node;
              if (carrier !== node) await journal.before(carrier);
              const position = sourceRelativeTransform(carrier);
              parent.appendChild(carrier);
              carrier.relativeTransform = position;
            }
            return node;
          }
          if (node.type === "INSTANCE" && s._class !== "symbolInstance" || node.type === "COMPONENT" && s._class !== "symbolMaster" || s._class === "symbolInstance" && node.type !== "INSTANCE") {
            c.finding(
              "TYPE_CONFLICT",
              "Source node type changed; existing editable node preserved to protect component relationships.",
              s,
              void 0,
              "error"
            );
            await hydrate(s);
            restoreAudits(s, node, true);
            return node;
          }
          await journal.before(node);
          if (node.type === "TEXT" || node.type === "TEXT_PATH")
            await loadCurrentFonts(c, node);
          report.updated++;
        } else {
          if (s._class === "symbolInstance") {
            const component = c.resources.components.get(String(s.symbolID));
            if (component) node = component.createInstance();
            else {
              node = createNode(c, { ...s, _class: "missingSymbol" });
              c.finding(
                "MISSING_SYMBOL",
                `Missing Symbol ${s.symbolID}; editable placeholder retains source dimensions and overrides.`,
                s,
                "/symbolID",
                "error"
              );
            }
          } else node = createNode(c, s);
          journal.track(node);
          report.created++;
        }
        if (node.type === "TEXT" || node.type === "TEXT_PATH")
          await loadCurrentFonts(c, node);
        const obsoleteFade = node.parent?.type === "FRAME" && node.parent.getPluginData("sketch2figma:fadeFor") === id ? node.parent : void 0;
        if (obsoleteFade) {
          await journal.before(obsoleteFade);
          obsoleteFade.visible = false;
          c.cleanup.add(obsoleteFade);
        }
        parent.appendChild(node);
        c.nodes.set(id, node);
        c.processed.add(id);
        mutable.add(id);
        node.setPluginData("sketch2figma:sourceId", id);
        node.setPluginData("sketch2figma:documentId", file.documentId);
        node.setRelaunchData({ open: `Reimport ${file.name}` });
        if (!fresh && node.type !== "INSTANCE") {
          if ("setFillStyleIdAsync" in node) await node.setFillStyleIdAsync("");
          if ("setStrokeStyleIdAsync" in node)
            await node.setStrokeStyleIdAsync("");
          if ("setEffectStyleIdAsync" in node)
            await node.setEffectStyleIdAsync("");
          if (node.type === "TEXT" && !c.resources.texts.has(s.sharedStyleID))
            await node.setTextStyleIdAsync("");
        }
        await applyGeometry(c, s, node);
        if (s._class !== "shapeGroup") await applyAppearance(c, s, node);
        if ((node.type === "TEXT" || node.type === "TEXT_PATH") && s._class === "text")
          try {
            await applyText(c, s, node, () => bindStyles(c, s, node));
          } catch (e) {
            c.finding("TEXT_FAILURE", String(e), s, "/attributedString", "error");
          }
        if ("children" in node && node.type !== "INSTANCE") {
          if (s._class === "shapeGroup") {
            const operands = [];
            for (const child of s.layers ?? []) {
              const priorOperand = await existing(child);
              if (priorOperand) {
                await journal.before(priorOperand);
                operands.push(priorOperand);
              }
            }
            await prepareBooleanRebuild(c, s, operands);
          }
          for (const child of s.layers ?? [])
            if (scope.has(sourceId(child)) || s._class === "symbolMaster" || dependency)
              await build(child, node, dependency || s._class === "symbolMaster");
          await applyLayout(c, s, node);
          for (const child of s.layers ?? []) {
            const cn = c.nodes.get(sourceId(child));
            if (cn) await applyChildLayout(c, child, cn);
          }
        }
        if (s._class === "shapeGroup" && node.type === "FRAME")
          try {
            await applyBooleanShape(c, s, node);
          } catch (error) {
            c.finding("BOOLEAN_CONVERSION", String(error), s, "/layers", "error");
            throw error;
          }
        if (node.type === "INSTANCE") {
          const component = c.resources.components.get(String(s.symbolID));
          if (component && (await node.getMainComponentAsync())?.id !== component.id)
            node.swapComponent(component);
          if (!fresh) node.removeOverrides();
          node.setPluginData("sketch2figma:sourceId", id);
          node.setPluginData("sketch2figma:documentId", file.documentId);
          node.setRelaunchData({ open: `Reimport ${file.name}` });
          await applyGeometry(c, s, node);
          await applyAppearance(c, s, node);
          await applyOverrides(c, s, node);
          c.ledger(s).mark("/symbolID");
        }
        if (node.type === "COMPONENT") {
          await componentProperties(c, s, node);
          c.resources.components.set(String(s.symbolID), node);
          c.ledger(s).mark("/symbolID");
        }
        await applyGuidesGrids(c, s, node);
        if (node.type !== "TEXT")
          await bindStyles(
            c,
            s,
            s._class === "shapeGroup" && "children" in node ? node.children.find(
              (child) => child.getPluginData("sketch2figma:wrapper") === "boolean" && !child.getPluginData("sketch2figma:obsolete")
            ) ?? node : node
          );
        c.ledger(s).result.targetId = node.id;
        writeData(node, "source", ownSource(s));
        return node;
      }
      try {
        c.fonts = await api.listAvailableFontsAsync();
        await importResources(c);
        const dep = dependencyOrder(available);
        for (const cycle of dep.cycles)
          c.finding(
            "SYMBOL_CYCLE",
            cycle.join(" \u2192 "),
            void 0,
            void 0,
            "error"
          );
        for (const master of dep.ordered) {
          const symbol = String(master.symbolID);
          if (!needed.has(symbol)) continue;
          const map = options.componentMap[symbol];
          if (map) {
            try {
              const component2 = map.startsWith("key:") ? await api.importComponentByKeyAsync(map.slice(4)) : await api.getNodeByIdAsync(map);
              if (!component2 || component2.type !== "COMPONENT")
                throw new Error("Replacement must be a component.");
              c.resources.components.set(symbol, component2);
              c.finding(
                "COMPONENT_MAPPING",
                `${master.name}: linked to an explicitly mapped Figma component.`,
                master,
                "/symbolID",
                "info"
              );
              continue;
            } catch (e) {
              c.finding(
                "COMPONENT_MAPPING",
                String(e),
                master,
                "/symbolID",
                "error"
              );
            }
          }
          const p = parentSources.get(sourceId(master));
          const parent = p?._class === "page" && scope.has(sourceId(p)) ? await pageFor(p) : await resourcesPage();
          const component = await build(master, parent, true);
          if (component.type === "COMPONENT")
            c.resources.components.set(symbol, component);
        }
        for (const p of file.pages) {
          if (!scope.has(sourceId(p))) continue;
          const page = await pageFor(p);
          for (const s of p.layers ?? [])
            if (scope.has(sourceId(s))) {
              const node = await build(s, page);
              if (node.parent?.id !== page.id && mutable.has(sourceId(s)))
                page.appendChild(node);
            }
        }
        for (const source of walkLayers(file.pages)) {
          const node = c.nodes.get(sourceId(source));
          if (!node || !mutable.has(sourceId(source)) || node.type === "VECTOR")
            continue;
          const parent = node.parent;
          if (parent?.type === "PAGE" || parent && "layoutMode" in parent && parent.layoutMode === "NONE" || "layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
            await journal.before(node);
            node.relativeTransform = transform(source);
          }
        }
        for (const p of file.pages)
          for (const container of walkLayers(p.layers ?? []))
            if (mutable.has(sourceId(container))) {
              const node = c.nodes.get(sourceId(container));
              if (node && "children" in node && node.type !== "INSTANCE")
                await reconstructMasks(c, container, node);
            }
        for (const source of walkLayers(file.pages)) {
          const node = c.nodes.get(sourceId(source));
          if (node && !preservedIds.has(sourceId(source)))
            await applyOpacityMask(c, source, node);
        }
        await applyTokenBindings(c, preservedIds);
        for (const [id, node] of c.nodes) {
          const source = sourceById.get(id);
          if (source && mutable.has(id) && node.type === "TEXT")
            await reconcileTextStyleBindings(c, source, node);
        }
        for (const [id, node] of c.nodes) {
          const source = sourceById.get(id);
          if (source && mutable.has(id) && node.type === "INSTANCE")
            for (const text of instanceTextSources(node, source))
              await reconcileTextStyleBindings(c, text.source, text.node, source);
        }
        await applyPrototypes(c, mutable);
        await validateImport(c, scope);
        const live = new Set(walkLayers(file.pages).map(sourceId));
        for (const [id, m] of Object.entries(index.nodes))
          if (!live.has(id))
            c.finding(
              "SOURCE_REMOVED",
              `Source layer ${id} is absent; imported target ${m.nodeId} retained to avoid deleting local work.`,
              void 0,
              id
            );
        for (const [id, node] of c.nodes) {
          const source = sourceById.get(id);
          if (source && !node.removed) {
            if (!preservedIds.has(id))
              index.nodes[id] = await mapping(node, source, c.conversionHash);
            const ledger = c.ledgers.get(id);
            if (ledger) writeData(node, "audit", ledger.finalize());
          }
        }
        const docSource = {
          ...input.document,
          _class: "document",
          do_objectID: `${file.documentId}:document`,
          name: file.name
        };
        c.ledger(docSource);
        const metaSource = {
          ...input.meta,
          _class: "sourceMetadata",
          do_objectID: `${file.documentId}:meta`,
          name: "Sketch metadata"
        };
        c.ledger(metaSource);
        const userSource = {
          ...input.user,
          _class: "sourceUserData",
          do_objectID: `${file.documentId}:user`,
          name: "Sketch user data"
        };
        c.ledger(userSource);
        writeData(api.root, `source:${file.documentId}`, {
          document: input.document,
          suppliedTokens: options.tokens,
          meta: input.meta,
          user: input.user,
          libraries: libraries.map((l) => ({
            documentId: l.documentId,
            document: l.document,
            meta: l.meta
          }))
        });
        index.sourceDigest = file.digest;
        writeIndex(api, index);
        journal.commit();
        try {
          await removeUnusedGeneratedStyles(c);
          writeIndex(api, index);
        } catch (error) {
          c.finding("LEGACY_STYLE_CLEANUP", String(error));
        }
        try {
          for (const obsolete of c.cleanup)
            if (!obsolete.removed) obsolete.remove();
        } catch (error) {
          c.finding("OWNED_NODE_CLEANUP", String(error));
        }
        try {
          for (const page of pages.values())
            for (const wrapper of page.findAll(
              (n) => n.type === "FRAME" && n.getPluginData("sketch2figma:wrapper") === "mask" && n.getPluginData("sketch2figma:documentId") === file.documentId && n.findAll(
                (child) => !!child.getPluginData("sketch2figma:sourceId")
              ).length === 0
            ))
              wrapper.remove();
        } catch (e) {
          c.finding("WRAPPER_CLEANUP", String(e));
        }
        report.sourceMetadataPreserved = true;
        report.state = "complete";
        const pageList = [...pages.values()];
        const last = pageList[pageList.length - 1];
        if (last)
          try {
            await api.setCurrentPageAsync(last);
          } catch (e) {
            c.finding("PAGE_FOCUS", String(e));
          }
      } catch (e) {
        report.state = String(e).includes("IMPORT_CANCELLED") ? "cancelled" : "failed";
        c.finding("IMPORT_STOPPED", String(e), void 0, void 0, "error");
        const errors = await journal.rollback();
        for (const error of errors)
          c.finding("RECOVERY_FAILURE", error, void 0, void 0, "error");
        report.sourceMetadataPreserved = false;
      }
      for (const source of walkLayers(input.pages))
        if (!c.ledgers.has(sourceId(source))) c.ledger(source, false);
      c.finish();
      finishReport(report);
      try {
        writeReport(api.root, report);
      } catch (error) {
        c.finding(
          "AUDIT_STORAGE",
          `Conversion audit could not be saved: ${error}`,
          void 0,
          void 0,
          "error"
        );
      }
      return report;
    })();
    return {
      cancel() {
        cancelled = true;
        if (ctx) ctx.cancelled = true;
      },
      result
    };
  }
  async function reconstructMasks(ctx, s, parent) {
    const layers = s.layers ?? [];
    for (let i2 = 0; i2 < layers.length; i2++) {
      const source = layers[i2];
      if (!source.hasClippingMask) continue;
      const mask = ctx.nodes.get(sourceId(source));
      if (!mask || !("isMask" in mask)) continue;
      const siblings = [mask];
      for (let j = i2 + 1; j < layers.length; j++) {
        if (layers[j].shouldBreakMaskChain || layers[j].hasClippingMask) break;
        const n = ctx.nodes.get(sourceId(layers[j]));
        if (n && n.parent?.id === parent.id) siblings.push(n);
      }
      for (const n of siblings) await ctx.journal.before(n);
      if (siblings.length > 1) {
        const wrapper = ctx.api.createFrame();
        ctx.journal.track(wrapper);
        wrapper.name = `Mask / ${source.name}`;
        wrapper.fills = [];
        wrapper.clipsContent = false;
        wrapper.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
        wrapper.resize(
          Math.max(0.01, parent.width),
          Math.max(0.01, parent.height)
        );
        const index = parent.children.indexOf(mask);
        parent.insertChild(Math.max(0, index), wrapper);
        wrapper.x = 0;
        wrapper.y = 0;
        for (const n of siblings) {
          const position = n.relativeTransform;
          wrapper.appendChild(n);
          n.relativeTransform = position;
        }
        wrapper.setPluginData("sketch2figma:wrapper", "mask");
        wrapper.setPluginData("sketch2figma:documentId", ctx.file.documentId);
      }
      const outline = source.clippingMaskMode === 0;
      const visibleAppearance = source.isVisible !== false && (source.image || [
        source.style?.fills,
        source.style?.borders,
        source.style?.shadows
      ].some(
        (values) => (values ?? []).some((value) => value.isEnabled !== false)
      ));
      if (outline && visibleAppearance) {
        const appearance = mask.clone();
        ctx.journal.track(appearance);
        const clearIdentity = (n) => {
          n.setPluginData("sketch2figma:sourceId", "");
          if ("children" in n)
            for (const child of n.children) clearIdentity(child);
        };
        clearIdentity(appearance);
        appearance.isMask = false;
        appearance.name = `Mask appearance / ${source.name}`;
        appearance.setPluginData("sketch2figma:wrapper", "outline-paint");
        appearance.setPluginData("sketch2figma:documentId", ctx.file.documentId);
        const container = mask.parent;
        const position = mask.relativeTransform;
        container.insertChild(container.children.indexOf(mask), appearance);
        appearance.relativeTransform = position;
        const painted = source._class === "shapeGroup" && "children" in appearance ? appearance.children.find(
          (child) => child.getPluginData("sketch2figma:wrapper") === "boolean" && !child.getPluginData("sketch2figma:obsolete")
        ) ?? appearance : appearance;
        await applyAppearance(ctx, source, painted);
        await bindStyles(ctx, source, painted);
      }
      mask.isMask = true;
      const boolean = "children" in mask ? mask.children.find(
        (child) => child.getPluginData("sketch2figma:wrapper") === "boolean" && !child.getPluginData("sketch2figma:obsolete")
      ) : void 0;
      mask.maskType = outline && !boolean ? "VECTOR" : "ALPHA";
      if (outline) {
        const geometry = boolean ?? mask;
        if ("fills" in geometry && (typeof geometry.fills === "symbol" || !geometry.fills.some(
          (p) => p.visible !== false && (p.opacity ?? 1) > 0
        ))) {
          geometry.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        }
        if ("effects" in geometry) geometry.effects = [];
        ctx.finding(
          "OUTLINE_MASK_GEOMETRY",
          "Outline geometry retained as a native mask. Visible source mask appearance is preserved behind it as an editable layer; empty source fills use opaque masking geometry only.",
          source,
          "/hasClippingMask",
          "info"
        );
      }
      ctx.ledger(source).fields(
        "",
        ["hasClippingMask", "clippingMaskMode"],
        "Editable Equivalent",
        "Native mask bounded by an editable wrapper to preserve Sketch mask-chain scope."
      );
    }
  }
  function withLibraries(file, libs) {
    if (!libs.length) return file;
    const known = masters(file), foreign = [...file.document.foreignSymbols ?? []], assets = [...file.assets];
    for (const lib of libs) {
      for (const [id, s] of masters(lib))
        if (!known.has(id)) {
          known.set(id, s);
          foreign.push({
            symbolMaster: s,
            libraryID: lib.documentId,
            sourceLibraryName: lib.name
          });
        }
      for (const a of lib.assets)
        if (!assets.some((x2) => x2.path === a.path)) assets.push(a);
    }
    return {
      ...file,
      document: {
        ...file.document,
        foreignSymbols: foreign,
        layerStyles: {
          ...file.document.layerStyles,
          objects: [
            ...file.document.layerStyles?.objects ?? [],
            ...libs.flatMap((l) => l.document.layerStyles?.objects ?? [])
          ]
        },
        layerTextStyles: {
          ...file.document.layerTextStyles,
          objects: [
            ...file.document.layerTextStyles?.objects ?? [],
            ...libs.flatMap((l) => l.document.layerTextStyles?.objects ?? [])
          ]
        },
        sharedSwatches: {
          ...file.document.sharedSwatches,
          objects: [
            ...file.document.sharedSwatches?.objects ?? [],
            ...libs.flatMap((l) => l.document.sharedSwatches?.objects ?? [])
          ]
        }
      },
      assets
    };
  }

  // src/plugin.ts
  figma.showUI(__html__, {
    width: 400,
    height: 520,
    themeColors: true,
    title: "Sketch \u2192 Figma"
  });
  var running;
  var send = (message) => figma.ui.postMessage(message);
  async function initialize() {
    const fonts = await figma.listAvailableFontsAsync();
    send({
      type: "ready",
      fonts: fonts.map((f) => f.fontName),
      hasReport: !!savedReportId(figma)
    });
  }
  figma.ui.onmessage = async (message) => {
    const m = message;
    let ownImport;
    try {
      if (m.type === "ui-ready") {
        await initialize();
        return;
      }
      if (m.type === "get-report") {
        if (running) return;
        const id = savedReportId(figma), report = id ? readReport(figma.root, id) : null;
        if (!report)
          throw new Error("No saved import report is available in this file.");
        send({ type: "saved-report", report: summarizeReport(report) });
        return;
      }
      if (m.type === "select-layer") {
        if (running || typeof m.targetId !== "string") return;
        const node = await figma.getNodeByIdAsync(m.targetId);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
          throw new Error("The imported layer is no longer available.");
        let page = node.parent;
        while (page && page.type !== "PAGE") page = page.parent;
        if (!page || page.type !== "PAGE")
          throw new Error("The imported layer has no page.");
        await figma.setCurrentPageAsync(page);
        page.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        return;
      }
      if (m.type === "cancel") {
        running?.cancel();
        return;
      }
      if (m.type === "import") {
        if (running) throw new Error("Another import is active.");
        if (!m.file || !Array.isArray(m.file.pages))
          throw new Error("Invalid import payload.");
        const options = { ...DEFAULT_OPTIONS, ...m.options };
        if (options.tokens) validateTokens(options.tokens);
        running = ownImport = startImport(
          figma,
          m.file,
          options,
          m.libraries ?? [],
          (done, name) => send({ type: "progress", requestId: m.requestId, done, name })
        );
        const report = await running.result;
        running = void 0;
        send({
          type: "report",
          requestId: m.requestId,
          report: summarizeReport(report)
        });
      }
    } catch (error) {
      if (ownImport && running === ownImport) running = void 0;
      send({ type: "error", requestId: m.requestId, message: String(error) });
    }
  };
})();
