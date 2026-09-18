;(() => {
  function Kt(t) {
    return (
      t instanceof Uint8Array ||
      (ArrayBuffer.isView(t) &&
        t.constructor.name === "Uint8Array" &&
        "BYTES_PER_ELEMENT" in t &&
        t.BYTES_PER_ELEMENT === 1)
    )
  }
  var wt = (t) => (t ? `"${t}" ` : "")
  function L(t, e = "") {
    if (typeof t !== "number")
      throw TypeError(wt(e) + "expected number, got " + typeof t)
    if (!Number.isSafeInteger(t) || t < 0)
      throw RangeError(wt(e) + "expected integer >= 0, got " + t)
    return t
  }
  function _(t, e, n = "") {
    if (Kt(t) && (e === void 0 || t.length === e)) return t
    if (e !== void 0) L(e, "length")
    let o = Kt(t),
      r = e !== void 0 ? ` of length ${e}` : "",
      s = o ? `length=${t.length}` : `type=${typeof t}`,
      i = wt(n) + "expected Uint8Array" + r + ", got " + s
    if (!o) throw TypeError(i)
    throw RangeError(i)
  }
  function X(t) {
    if (typeof t !== "function" || typeof t.create !== "function")
      throw TypeError("expected hash wrapped by utils.createHasher")
    if ((L(t.outputLen), L(t.blockLen), t.outputLen < 1 || t.blockLen < 1))
      throw Error("hash blockLen / outputLen must be >= 1")
  }
  var ue = (t, e) => {
      if (t === null || typeof t !== "object" || Array.isArray(t))
        throw TypeError(
          (e === "object" ? "" : `"${e}" `) +
            "expected object, got type=" +
            typeof t
        )
    },
    Nt = (t, e) => {
      ue(t, e)
      let n = Object.getPrototypeOf(t)
      if (n !== Object.prototype && n !== null)
        throw TypeError(`"${e}" expected plain object`)
      if (Object.hasOwn(t, "__proto__"))
        throw TypeError(`"${e}.__proto__" is not allowed`)
    }
  function J(t, e = !0) {
    if (t.destroyed) throw Error("hash was destroyed")
    if (e && t.finished) throw Error("digest() was already called")
  }
  function ut(t, e) {
    _(t, void 0, "output")
    let n = e.outputLen
    if (!(t.length >= n)) throw RangeError('"output" expected length >= ' + n)
  }
  function ht(t) {
    return new Uint32Array(t.buffer, t.byteOffset, Math.floor(t.byteLength / 4))
  }
  function E(...t) {
    for (let e = 0; e < t.length; e++) t[e].fill(0)
  }
  function Q(t) {
    return new DataView(t.buffer, t.byteOffset, t.byteLength)
  }
  function k(t, e) {
    return (t << (32 - e)) | (t >>> e)
  }
  function y(t, e) {
    return (t << e) | ((t >>> (32 - e)) >>> 0)
  }
  var he = (() =>
    new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)()
  function le(t) {
    return (
      ((t << 24) & 4278190080) |
      ((t << 8) & 16711680) |
      ((t >>> 8) & 65280) |
      ((t >>> 24) & 255)
    )
  }
  function de(t) {
    for (let e = 0; e < t.length; e++) t[e] = le(t[e])
    return t
  }
  var mt = he ? (t) => t : de,
    Rt = (() =>
      typeof Uint8Array.from([]).toHex === "function" &&
      typeof Uint8Array.fromHex === "function")(),
    pe = Array.from({ length: 256 }, (t, e) => e.toString(16).padStart(2, "0"))
  function Pt(t) {
    if ((_(t), Rt)) return t.toHex()
    let e = ""
    for (let n = 0; n < t.length; n++) e += pe[t[n]]
    return e
  }
  function jt(t) {
    return t >= 48 && t <= 57
      ? t - 48
      : t >= 65 && t <= 70
        ? t - 55
        : t >= 97 && t <= 102
          ? t - 87
          : void 0
  }
  function vt(t) {
    if (typeof t !== "string")
      throw TypeError("hex string expected, got " + typeof t)
    if (Rt)
      try {
        return Uint8Array.fromHex(t)
      } catch (r) {
        if (r instanceof SyntaxError) throw RangeError(r.message)
        throw r
      }
    let e = t.length,
      n = e / 2
    if (e % 2)
      throw RangeError("hex string expected, got unpadded hex of length " + e)
    let o = new Uint8Array(n)
    for (let r = 0, s = 0; r < n; r++, s += 2) {
      let i = jt(t.charCodeAt(s)),
        c = jt(t.charCodeAt(s + 1))
      if (i === void 0 || c === void 0) {
        let f = t[s] + t[s + 1]
        throw RangeError(
          'hex string expected, got non-hex character "' + f + '" at index ' + s
        )
      }
      o[r] = i * 16 + c
    }
    return o
  }
  function xe(t) {
    if (typeof t !== "string") throw TypeError("string expected")
    let e = new TextEncoder().encode(t)
    try {
      return new Uint8Array(e)
    } finally {
      E(e)
    }
  }
  function Et(t, e = "") {
    if (typeof t === "string") return xe(t)
    return _(t, void 0, e)
  }
  function ot(t, e, n = "opts") {
    if ((Nt(t, "defaults"), e !== void 0)) Nt(e, n)
    return Object.assign(Object.create(null), t, e)
  }
  function Ft(t, e = {}) {
    if (typeof t !== "function")
      throw TypeError('"hashCons" expected function, got type=' + typeof t)
    e = ot({}, e, "info")
    let n = (r, s) => t(s).update(r).digest(),
      o = t(void 0)
    return (
      (n.outputLen = o.outputLen),
      (n.blockLen = o.blockLen),
      (n.canXOF = o.canXOF),
      (n.create = (r) => t(r)),
      Object.assign(n, e),
      Object.freeze(n)
    )
  }
  var zt = (t) => ({
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, t]),
  })
  class At {
    oHash
    iHash
    blockLen
    outputLen
    canXOF = !1
    finished = !1
    destroyed = !1
    constructor(t, e) {
      if (
        (X(t),
        _(e, void 0, "key"),
        (this.iHash = t.create()),
        typeof this.iHash.update !== "function")
      )
        throw Error("expected Hash instance")
      ;((this.blockLen = this.iHash.blockLen),
        (this.outputLen = this.iHash.outputLen))
      let n = this.blockLen,
        o = new Uint8Array(n)
      o.set(e.length > n ? t.create().update(e).digest() : e)
      for (let r = 0; r < o.length; r++) o[r] ^= 54
      ;(this.iHash.update(o), (this.oHash = t.create()))
      for (let r = 0; r < o.length; r++) o[r] ^= 106
      ;(this.oHash.update(o), E(o))
    }
    update(t) {
      return (J(this), this.iHash.update(t), this)
    }
    digestInto(t) {
      ;(J(this), ut(t, this), (this.finished = !0))
      let e = t.subarray(0, this.outputLen)
      ;(this.iHash.digestInto(e),
        this.oHash.update(e),
        this.oHash.digestInto(e),
        this.destroy())
    }
    digest() {
      let t = new Uint8Array(this.oHash.outputLen)
      return (this.digestInto(t), t)
    }
    _cloneInto(t) {
      t ||= Object.create(Object.getPrototypeOf(this), {})
      let {
        oHash: e,
        iHash: n,
        finished: o,
        destroyed: r,
        blockLen: s,
        outputLen: i,
        canXOF: c,
      } = this
      return (
        (t = t),
        (t.finished = o),
        (t.destroyed = r),
        (t.blockLen = s),
        (t.outputLen = i),
        (t.canXOF = c),
        (t.oHash = e._cloneInto(t.oHash)),
        (t.iHash = n._cloneInto(t.iHash)),
        t
      )
    }
    clone() {
      return this._cloneInto()
    }
    destroy() {
      ;((this.destroyed = !0), this.oHash.destroy(), this.iHash.destroy())
    }
  }
  var rt = (() => {
    let t = (e, n, o) => new At(e, n).update(o).digest()
    return ((t.create = (e, n) => new At(e, n)), t)
  })()
  function ge(t, e, n, o) {
    X(t)
    let r = ot({ dkLen: 32, asyncTick: 10 }, o),
      { c: s, dkLen: i, asyncTick: c } = r
    if ((L(s, "c"), L(i, "dkLen"), L(c, "asyncTick"), s < 1))
      throw Error('"c" (iterations) must be >= 1')
    if (i < 1) throw Error('"dkLen" must be >= 1')
    if (i > 4294967295 * t.outputLen) throw Error("derived key too long")
    let f = Et(e, "password")
    try {
      let u = Et(n, "salt")
      try {
        let a = new Uint8Array(i),
          { iHash: h, oHash: l, outputLen: d } = rt.create(t, f),
          p = new Uint8Array(d),
          x = be(h, l, u, p)
        return { c: s, dkLen: i, asyncTick: c, DK: a, outputLen: d, eng: x }
      } finally {
        if (typeof n === "string") E(u)
      }
    } finally {
      if (typeof e === "string") E(f)
    }
  }
  function be(t, e, n, o) {
    let r = new Uint8Array(4),
      s = Q(r),
      i = t._cloneInto().update(n),
      c = e._cloneInto(),
      f = t._cloneInto,
      u = e._cloneInto
    return {
      u1: (a, h) => {
        ;(s.setInt32(0, a, !1),
          i._cloneInto(c).update(r).digestInto(o),
          e._cloneInto(c).update(o).digestInto(o),
          h.set(o.subarray(0, h.length)))
      },
      rounds: (a, h) => {
        for (let l = 1; l < a; l++) {
          ;(f.call(t, c).update(o).digestInto(o),
            u.call(e, c).update(o).digestInto(o))
          for (let d = 0; d < h.length; d++) h[d] ^= o[d]
        }
      },
      output: (a) => (
        t.destroy(),
        e.destroy(),
        i.destroy(),
        c.destroy(),
        E(o),
        a
      ),
    }
  }
  function Lt(t, e, n, o) {
    let { c: r, dkLen: s, DK: i, outputLen: c, eng: f } = ge(t, e, n, o)
    for (let u = 1, a = 0; a < s; u++, a += c) {
      let h = i.subarray(a, a + c)
      ;(f.u1(u, h), f.rounds(r, h))
    }
    return f.output(i)
  }
  var we = (t) => (t / 4294967296) | 0,
    me = (t) => t >>> 0
  function $t(t, e, n, o) {
    let r = we(n),
      s = me(n)
    ;(t.setUint32(e, o ? s : r, o), t.setUint32(e + 4, o ? r : s, o))
  }
  function Gt(t, e, n) {
    return (t & e) ^ (~t & n)
  }
  function Wt(t, e, n) {
    return (t & e) ^ (t & n) ^ (e & n)
  }
  class Ut {
    blockLen
    outputLen
    canXOF = !1
    padOffset
    isLE
    buffer
    view
    finished = !1
    length = 0
    pos = 0
    destroyed = !1
    constructor(t, e, n, o) {
      ;((this.blockLen = t),
        (this.outputLen = e),
        (this.padOffset = n),
        (this.isLE = o),
        (this.buffer = new Uint8Array(t)),
        (this.view = Q(this.buffer)))
    }
    update(t) {
      ;(J(this), _(t))
      let { view: e, buffer: n, blockLen: o } = this,
        r = t.length,
        s = !1
      for (let i = 0; i < r;) {
        let c = Math.min(o - this.pos, r - i)
        if (c === o) {
          let f = Q(t)
          for (; o <= r - i; i += o) this.process(f, i)
          s = !0
          continue
        }
        if (
          (n.set(i === 0 && c === r ? t : t.subarray(i, i + c), this.pos),
          (this.pos += c),
          (i += c),
          this.pos === o)
        )
          (this.process(e, 0), (this.pos = 0), (s = !0))
      }
      if (((this.length += t.length), s)) this.roundClean()
      return this
    }
    digestInto(t) {
      ;(J(this), ut(t, this), (this.finished = !0))
      let { buffer: e, view: n, blockLen: o, isLE: r } = this,
        { pos: s } = this
      if (((e[s++] = 128), e.fill(0, s), this.padOffset > o - s))
        (this.process(n, 0), e.fill(0))
      ;($t(n, o - 8, this.length * 8, r), this.process(n, 0), this.roundClean())
      let i = t === e ? n : Q(t),
        c = this.outputLen,
        f = c / 4,
        u = this.get()
      if (c % 4 || f > u.length) throw Error("invalid outputLen")
      for (let a = 0; a < f; a++) i.setUint32(4 * a, u[a], r)
    }
    digest() {
      let { buffer: t, outputLen: e } = this
      this.digestInto(t)
      let n = t.slice(0, e)
      return (this.destroy(), n)
    }
    _cloneIntoMeta(t) {
      let { buffer: e, length: n, finished: o, destroyed: r, pos: s } = this
      if (((t.destroyed = r), (t.finished = o), (t.length = n), (t.pos = s), s))
        t.buffer.set(e)
      return t
    }
    clone() {
      return this._cloneInto()
    }
  }
  var Vt = Uint32Array.from([
    1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
    528734635, 1541459225,
  ])
  var Ee = Uint32Array.from([
      1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
      2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
      1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
      264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
      2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
      113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
      1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
      3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
      430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
      1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
      2428436474, 2756734187, 3204031479, 3329325298,
    ]),
    M = new Uint32Array(64)
  class Yt extends Ut {
    A = 0
    B = 0
    C = 0
    D = 0
    E = 0
    F = 0
    G = 0
    H = 0
    constructor(t, e) {
      super(64, t, 8, !1)
      ;((this.A = e[0] | 0),
        (this.B = e[1] | 0),
        (this.C = e[2] | 0),
        (this.D = e[3] | 0),
        (this.E = e[4] | 0),
        (this.F = e[5] | 0),
        (this.G = e[6] | 0),
        (this.H = e[7] | 0))
    }
    get() {
      let { A: t, B: e, C: n, D: o, E: r, F: s, G: i, H: c } = this
      return [t, e, n, o, r, s, i, c]
    }
    set(t, e, n, o, r, s, i, c) {
      ;((this.A = t | 0),
        (this.B = e | 0),
        (this.C = n | 0),
        (this.D = o | 0),
        (this.E = r | 0),
        (this.F = s | 0),
        (this.G = i | 0),
        (this.H = c | 0))
    }
    _cloneInto(t) {
      return (
        (t ||= new this.constructor()).set(...this.get()),
        this._cloneIntoMeta(t)
      )
    }
    process(t, e) {
      for (let a = 0; a < 16; a++, e += 4) M[a] = t.getUint32(e, !1)
      for (let a = 16; a < 64; a++) {
        let h = M[a - 15],
          l = M[a - 2],
          d = k(h, 7) ^ k(h, 18) ^ (h >>> 3),
          p = k(l, 17) ^ k(l, 19) ^ (l >>> 10)
        M[a] = (p + M[a - 7] + d + M[a - 16]) | 0
      }
      let { A: n, B: o, C: r, D: s, E: i, F: c, G: f, H: u } = this
      for (let a = 0; a < 64; a++) {
        let h = k(i, 6) ^ k(i, 11) ^ k(i, 25),
          l = (u + h + Gt(i, c, f) + Ee[a] + M[a]) | 0,
          p = ((k(n, 2) ^ k(n, 13) ^ k(n, 22)) + Wt(n, o, r)) | 0
        ;((u = f),
          (f = c),
          (c = i),
          (i = (s + l) | 0),
          (s = r),
          (r = o),
          (o = n),
          (n = (l + p) | 0))
      }
      ;((n = (n + this.A) | 0),
        (o = (o + this.B) | 0),
        (r = (r + this.C) | 0),
        (s = (s + this.D) | 0),
        (i = (i + this.E) | 0),
        (c = (c + this.F) | 0),
        (f = (f + this.G) | 0),
        (u = (u + this.H) | 0),
        this.set(n, o, r, s, i, c, f, u))
    }
    roundClean() {
      E(M)
    }
    destroy() {
      ;((this.destroyed = !0), this.set(0, 0, 0, 0, 0, 0, 0, 0), E(this.buffer))
    }
  }
  class Xt extends Yt {
    constructor() {
      super(32, Vt)
    }
  }
  var st = Ft(() => new Xt(), zt(1))
  function qt(t, e, n, o, r, s) {
    let i = t[e++] ^ n[o++],
      c = t[e++] ^ n[o++],
      f = t[e++] ^ n[o++],
      u = t[e++] ^ n[o++],
      a = t[e++] ^ n[o++],
      h = t[e++] ^ n[o++],
      l = t[e++] ^ n[o++],
      d = t[e++] ^ n[o++],
      p = t[e++] ^ n[o++],
      x = t[e++] ^ n[o++],
      g = t[e++] ^ n[o++],
      b = t[e++] ^ n[o++],
      m = t[e++] ^ n[o++],
      U = t[e++] ^ n[o++],
      B = t[e++] ^ n[o++],
      S = t[e++] ^ n[o++],
      T = i,
      H = c,
      I = f,
      D = u,
      K = a,
      N = h,
      j = l,
      R = d,
      P = p,
      v = x,
      F = g,
      z = b,
      G = m,
      W = U,
      V = B,
      Y = S
    for (let Dt = 0; Dt < 8; Dt += 2)
      ((K ^= y((T + G) | 0, 7)),
        (P ^= y((K + T) | 0, 9)),
        (G ^= y((P + K) | 0, 13)),
        (T ^= y((G + P) | 0, 18)),
        (v ^= y((N + H) | 0, 7)),
        (W ^= y((v + N) | 0, 9)),
        (H ^= y((W + v) | 0, 13)),
        (N ^= y((H + W) | 0, 18)),
        (V ^= y((F + j) | 0, 7)),
        (I ^= y((V + F) | 0, 9)),
        (j ^= y((I + V) | 0, 13)),
        (F ^= y((j + I) | 0, 18)),
        (D ^= y((Y + z) | 0, 7)),
        (R ^= y((D + Y) | 0, 9)),
        (z ^= y((R + D) | 0, 13)),
        (Y ^= y((z + R) | 0, 18)),
        (H ^= y((T + D) | 0, 7)),
        (I ^= y((H + T) | 0, 9)),
        (D ^= y((I + H) | 0, 13)),
        (T ^= y((D + I) | 0, 18)),
        (j ^= y((N + K) | 0, 7)),
        (R ^= y((j + N) | 0, 9)),
        (K ^= y((R + j) | 0, 13)),
        (N ^= y((K + R) | 0, 18)),
        (z ^= y((F + v) | 0, 7)),
        (P ^= y((z + F) | 0, 9)),
        (v ^= y((P + z) | 0, 13)),
        (F ^= y((v + P) | 0, 18)),
        (G ^= y((Y + V) | 0, 7)),
        (W ^= y((G + Y) | 0, 9)),
        (V ^= y((W + G) | 0, 13)),
        (Y ^= y((V + W) | 0, 18)))
    ;((r[s++] = (i + T) | 0),
      (r[s++] = (c + H) | 0),
      (r[s++] = (f + I) | 0),
      (r[s++] = (u + D) | 0),
      (r[s++] = (a + K) | 0),
      (r[s++] = (h + N) | 0),
      (r[s++] = (l + j) | 0),
      (r[s++] = (d + R) | 0),
      (r[s++] = (p + P) | 0),
      (r[s++] = (x + v) | 0),
      (r[s++] = (g + F) | 0),
      (r[s++] = (b + z) | 0),
      (r[s++] = (m + G) | 0),
      (r[s++] = (U + W) | 0),
      (r[s++] = (B + V) | 0),
      (r[s++] = (S + Y) | 0))
  }
  function Bt(t, e, n, o, r) {
    let s = o + 0,
      i = o + 16 * r
    for (let c = 0; c < 16; c++) n[i + c] = t[e + (2 * r - 1) * 16 + c]
    for (let c = 0; c < r; c++, s += 16, e += 16) {
      if ((qt(n, i, t, e, n, s), c > 0)) i += 16
      qt(n, s, t, (e += 16), n, i)
    }
  }
  var Ae = 1073743872
  function Le(t, e, n) {
    let o = ot({ dkLen: 32, asyncTick: 10, maxmem: Ae }, n),
      { N: r, r: s, p: i, dkLen: c, asyncTick: f, maxmem: u, onProgress: a } = o
    if (
      (L(r, "N"),
      L(s, "r"),
      L(i, "p"),
      L(c, "dkLen"),
      L(f, "asyncTick"),
      L(u, "maxmem"),
      a !== void 0 && typeof a !== "function")
    )
      throw Error('"onProgress" must be a function')
    if (s < 1) throw Error('"r" expected integer >= 1')
    let h = 128 * s,
      l = h / 4,
      d = Math.pow(2, 32)
    if (r <= 1 || (r & (r - 1)) !== 0 || r > d)
      throw Error('"N" expected a power of 2, and 2^1 <= N <= 2^32')
    if (i < 1 || i > ((d - 1) * 32) / h)
      throw Error('"p" expected integer 1..((2^32 - 1) * 32) / (128 * r)')
    if (c < 1 || c > (d - 1) * 32)
      throw Error('"dkLen" expected integer 1..(2^32 - 1) * 32')
    let p = h * (r + i + 1)
    if (p > u)
      throw Error(
        '"maxmem" limit was hit: memUsed(128*r*(N+p+1))=' + p + ", maxmem=" + u
      )
    let x = Lt(st, t, e, { c: 1, dkLen: h * i }),
      g = ht(x),
      b = ht(new Uint8Array(h * r)),
      m = ht(new Uint8Array(h)),
      U = () => {}
    if (a) {
      let B = 2 * r * i,
        S = Math.max(Math.floor(B / 1e4), 1),
        T = 0
      U = () => {
        if ((T++, a && (!(T % S) || T === B)))
          try {
            a(T / B)
          } catch (H) {
            throw (E(x, b, m), H)
          }
      }
    }
    return {
      N: r,
      r: s,
      p: i,
      dkLen: c,
      blockSize32: l,
      V: b,
      B32: g,
      B: x,
      tmp: m,
      blockMixCb: U,
      asyncTick: f,
    }
  }
  function Ue(t, e, n, o, r) {
    let s = Lt(st, t, n, { c: 1, dkLen: e })
    return (E(n, o, r), s)
  }
  function Zt(t, e, n) {
    let {
      N: o,
      r,
      p: s,
      dkLen: i,
      blockSize32: c,
      V: f,
      B32: u,
      B: a,
      tmp: h,
      blockMixCb: l,
    } = Le(t, e, n)
    mt(u)
    for (let d = 0; d < s; d++) {
      let p = c * d
      for (let x = 0; x < c; x++) f[x] = u[p + x]
      for (let x = 0, g = 0; x < o - 1; x++) (Bt(f, g, f, (g += c), r), l())
      ;(Bt(f, (o - 1) * c, u, p, r), l())
      for (let x = 0; x < o; x++) {
        let g = (u[p + c - 16] & (o - 1)) >>> 0
        for (let b = 0; b < c; b++) h[b] = u[p + b] ^ f[g * c + b]
        ;(Bt(h, 0, u, p, r), l())
      }
    }
    return (mt(u), Ue(t, i, a, f, h))
  }
  var ct = Uint8Array.of(0),
    Be = Uint8Array.of()
  function Te(t, e, n, o = 32, r) {
    ;(X(t), L(o, "length"), _(e, void 0, "prk"))
    let s = t.outputLen
    if (e.length < s) throw Error('"prk" must be at least HashLen octets')
    if (o > 255 * s) throw Error("Length must be <= 255*HashLen")
    let i = Math.ceil(o / s)
    if (n === void 0) n = Be
    else _(n, void 0, "info")
    if (!i) {
      if (r) E(e)
      return new Uint8Array()
    }
    let c = r && i === 1 ? e : new Uint8Array(i * s),
      { iHash: f, oHash: u } = rt.create(t, e),
      a = r ? e : new Uint8Array(s),
      h = i > 1 ? r?.iHash || t.create() : void 0
    for (let d = 0; d < i - 1; d++) {
      ct[0] = d + 1
      let p = f._cloneInto(h)
      if (d) p.update(a)
      ;(p.update(n).update(ct).digestInto(a),
        u._cloneInto(h).update(a).digestInto(a),
        c.set(a, s * d))
    }
    if (((ct[0] = i), i > 1)) f.update(a)
    if (
      (f.update(n).update(ct).digestInto(a),
      u.update(a).digestInto(a),
      c.set(a, s * (i - 1)),
      f.destroy(),
      u.destroy(),
      h?.destroy(),
      a !== c)
    )
      E(a)
    if ((E(ct), o === c.length)) return c
    let l = c.slice(0, o)
    return (E(c), l)
  }
  var Jt = (t, e, n, o, r) => {
    if ((X(t), n === void 0)) n = new Uint8Array(t.outputLen)
    let s = rt.create(t, n).update(e)
    return Te(t, s.digest(), o, r, s)
  }
  /*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */ function Tt(
    t
  ) {
    return (
      t instanceof Uint8Array ||
      (ArrayBuffer.isView(t) &&
        t.constructor.name === "Uint8Array" &&
        "BYTES_PER_ELEMENT" in t &&
        t.BYTES_PER_ELEMENT === 1)
    )
  }
  var lt = (t) => (t ? `"${t}" ` : "")
  function Se(t, e = "") {
    if (typeof t !== "boolean")
      throw TypeError(lt(e) + "expected boolean, got type=" + typeof t)
    return t
  }
  function dt(t, e = "") {
    if (typeof t !== "number")
      throw TypeError(lt(e) + "expected number, got " + typeof t)
    if (!Number.isSafeInteger(t) || t < 0)
      throw RangeError(lt(e) + "expected integer >= 0, got " + t)
    return t
  }
  function A(t, e, n = "") {
    if (Tt(t) && (e === void 0 || t.length === e)) return t
    if (e !== void 0) dt(e, "length")
    let o = Tt(t),
      r = e !== void 0 ? ` of length ${e}` : "",
      s = o ? `length=${t.length}` : `type=${typeof t}`,
      i = lt(n) + "expected Uint8Array" + r + ", got " + s
    if (!o) throw TypeError(i)
    throw RangeError(i)
  }
  function pt(t, e = !0) {
    if (t.destroyed) throw Error("hash was destroyed")
    if (e && t.finished) throw Error("digest() was already called")
  }
  function He(t, e) {
    A(t, void 0, "output")
    let n = e.outputLen
    if (!(t.length >= n)) throw RangeError('"output" expected length >= ' + n)
  }
  function St(t, e) {
    if ((He(t, e), !nt(t))) throw Error("invalid output, must be aligned")
  }
  function Qt(t) {
    return new Uint8Array(t.buffer, t.byteOffset, t.byteLength)
  }
  function O(t) {
    return new Uint32Array(t.buffer, t.byteOffset, Math.floor(t.byteLength / 4))
  }
  function C(...t) {
    for (let e = 0; e < t.length; e++) t[e].fill(0)
  }
  function tt(t) {
    return new DataView(t.buffer, t.byteOffset, t.byteLength)
  }
  var et = (() =>
    new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)()
  function Ht(t) {
    return (
      ((t << 24) & 4278190080) |
      ((t << 8) & 16711680) |
      ((t >>> 8) & 65280) |
      ((t >>> 24) & 255)
    )
  }
  var w = et ? (t) => t : (t) => Ht(t) >>> 0
  function ke(t) {
    for (let e = 0; e < t.length; e++) t[e] = Ht(t[e])
    return t
  }
  var it = et ? (t) => t : ke
  function te(t, e) {
    if (((t = A(t)), (e = A(e)), t.length !== e.length)) return !1
    let n = 0
    for (let o = 0; o < t.length; o++) n |= t[o] ^ e[o]
    return n === 0
  }
  function kt(t, e, n) {
    let o = e,
      r = n || (() => []),
      s = (c, f) =>
        o(f, ...r(c))
          .update(c)
          .digest(),
      i = o(new Uint8Array(t), ...r(new Uint8Array(0)))
    return (
      (s.outputLen = i.outputLen),
      (s.blockLen = i.blockLen),
      (s.create = (c, ...f) => o(c, ...f)),
      s
    )
  }
  var ee = (t, e) => {
    function n(o, ...r) {
      if ((A(o, void 0, "key"), t.nonceLength !== void 0)) {
        let h = r[0]
        A(h, t.varSizeNonce ? void 0 : t.nonceLength, "nonce")
      }
      let s = t.tagLength,
        i = t.nonceLength !== void 0 ? 1 : 0
      if (!t.withAAD) {
        for (let h = i; h < r.length; h++)
          if (Tt(r[h])) throw Error("AAD not supported")
      }
      if (t.withAAD && r[i] !== void 0) A(r[i], void 0, "AAD")
      let c = e(o, ...r),
        f = (h, l) => {
          if (l !== void 0) {
            if (h !== 2) throw Error("cipher output not supported")
            A(l, void 0, "output")
          }
        },
        u = !1
      return {
        encrypt(h, l) {
          if (u) throw Error("cannot encrypt() twice with same key + nonce")
          return (
            (u = !0),
            A(h, void 0, "data"),
            f(c.encrypt.length, l),
            c.encrypt(h, l)
          )
        },
        decrypt(h, l) {
          if ((A(h, void 0, "data"), s && h.length < s))
            throw Error('"ciphertext" expected length >= tagLength=' + s)
          return (f(c.decrypt.length, l), c.decrypt(h, l))
        },
      }
    }
    return (Object.assign(n, t), n)
  }
  function ne(t, e, n = !0) {
    if (e === void 0) return new Uint8Array(t)
    if ((A(e, t, "output"), n && !nt(e)))
      throw Error("invalid output, must be aligned")
    return e
  }
  function oe(t, e, n) {
    ;(dt(t), dt(e), Se(n))
    let o = new Uint8Array(16),
      r = tt(o)
    return (r.setBigUint64(0, BigInt(e), n), r.setBigUint64(8, BigInt(t), n), o)
  }
  function nt(t) {
    return t.byteOffset % 4 === 0
  }
  function q(t) {
    return Uint8Array.from(A(t))
  }
  var Z = 16,
    re = new Uint8Array(16),
    ft = O(re),
    _e = 225,
    Ce = (t, e, n, o) => {
      let r = o & 1
      return {
        s3: (n << 31) | (o >>> 1),
        s2: (e << 31) | (n >>> 1),
        s1: (t << 31) | (e >>> 1),
        s0: (t >>> 1) ^ ((_e << 24) & -(r & 1)),
      }
    },
    xt = (t) =>
      (((t >>> 0) & 255) << 24) |
      (((t >>> 8) & 255) << 16) |
      (((t >>> 16) & 255) << 8) |
      ((t >>> 24) & 255) |
      0
  var Ie = (t) => {
    if (t > 65536) return 8
    if (t > 1024) return 4
    return 2
  }
  class se {
    blockLen = Z
    outputLen = Z
    s0 = 0
    s1 = 0
    s2 = 0
    s3 = 0
    finished = !1
    destroyed = !1
    t
    W
    windowSize
    constructor(t, e) {
      ;(A(t, 16, "key"), (t = q(t)))
      let n = tt(t),
        o = n.getUint32(0, !1),
        r = n.getUint32(4, !1),
        s = n.getUint32(8, !1),
        i = n.getUint32(12, !1),
        c = []
      for (let d = 0; d < 128; d++)
        (c.push({ s0: xt(o), s1: xt(r), s2: xt(s), s3: xt(i) }),
          ({ s0: o, s1: r, s2: s, s3: i } = Ce(o, r, s, i)))
      let f = Ie(e || 1024)
      if (![1, 2, 4, 8].includes(f))
        throw Error("ghash: invalid window size, expected 2, 4 or 8")
      this.W = f
      let a = 128 / f,
        h = (this.windowSize = 2 ** f),
        l = []
      for (let d = 0; d < a; d++)
        for (let p = 0; p < h; p++) {
          let x = 0,
            g = 0,
            b = 0,
            m = 0
          for (let U = 0; U < f; U++) {
            if (!((p >>> (f - U - 1)) & 1)) continue
            let { s0: S, s1: T, s2: H, s3: I } = c[f * d + U]
            ;((x ^= S), (g ^= T), (b ^= H), (m ^= I))
          }
          l.push({ s0: x, s1: g, s2: b, s3: m })
        }
      this.t = l
    }
    _updateBlock(t, e, n, o) {
      ;((t ^= this.s0), (e ^= this.s1), (n ^= this.s2), (o ^= this.s3))
      let { W: r, t: s, windowSize: i } = this,
        c = 0,
        f = 0,
        u = 0,
        a = 0,
        h = (1 << r) - 1,
        l = 0
      for (let d of [t, e, n, o])
        for (let p = 0; p < 4; p++) {
          let x = (d >>> (8 * p)) & 255
          for (let g = 8 / r - 1; g >= 0; g--) {
            let b = (x >>> (r * g)) & h,
              { s0: m, s1: U, s2: B, s3: S } = s[l * i + b]
            ;((c ^= m), (f ^= U), (u ^= B), (a ^= S), (l += 1))
          }
        }
      ;((this.s0 = c), (this.s1 = f), (this.s2 = u), (this.s3 = a))
    }
    update(t) {
      ;(pt(this), A(t), (t = q(t)))
      let e = O(t),
        n = Math.floor(t.length / Z),
        o = t.length % Z
      for (let r = 0; r < n; r++)
        this._updateBlock(
          w(e[r * 4 + 0]),
          w(e[r * 4 + 1]),
          w(e[r * 4 + 2]),
          w(e[r * 4 + 3])
        )
      if (o)
        (re.set(t.subarray(n * Z)),
          this._updateBlock(w(ft[0]), w(ft[1]), w(ft[2]), w(ft[3])),
          C(ft))
      return this
    }
    destroy() {
      this.destroyed = !0
      let { t } = this
      for (let e of t) ((e.s0 = 0), (e.s1 = 0), (e.s2 = 0), (e.s3 = 0))
    }
    digestInto(t) {
      ;(pt(this), St(t, this), (this.finished = !0))
      let { s0: e, s1: n, s2: o, s3: r } = this,
        s = O(t)
      if (((s[0] = e), (s[1] = n), (s[2] = o), (s[3] = r), !et))
        it(s.subarray(0, Z / 4))
    }
    digest() {
      let t = new Uint8Array(Z)
      return (this.digestInto(t), this.destroy(), t)
    }
  }
  var _t = kt(
    16,
    (t, e) => new se(t, e),
    (t) => [t.length]
  )
  var It = 16,
    Oe = 4,
    yt = new Uint8Array(It)
  var Me = 283
  function De(t) {
    if (![16, 24, 32].includes(t.length))
      throw Error(
        '"aes key" expected Uint8Array of length 16/24/32, got length=' +
          t.length
      )
  }
  function Ot(t) {
    return (t << 1) ^ (Me & -(t >> 7))
  }
  function ce(t, e) {
    let n = 0
    for (; e > 0; e >>= 1) ((n ^= t & -(e & 1)), (t = Ot(t)))
    return n
  }
  var Ke = (() => {
    let t = new Uint8Array(256)
    for (let n = 0, o = 1; n < 256; n++, o ^= Ot(o)) t[n] = o
    let e = new Uint8Array(256)
    e[0] = 99
    for (let n = 0; n < 255; n++) {
      let o = t[255 - n]
      ;((o |= o << 8),
        (e[t[n]] = (o ^ (o >> 4) ^ (o >> 5) ^ (o >> 6) ^ (o >> 7) ^ 99) & 255))
    }
    return (C(t), e)
  })()
  var Ne = (t) => (t << 24) | (t >>> 8),
    Ct = (t) => (t << 8) | (t >>> 24)
  function je(t, e) {
    if (t.length !== 256) throw Error("wrong sbox length")
    let n = new Uint32Array(256).map((u, a) => e(t[a])),
      o = n.map(Ct),
      r = o.map(Ct),
      s = r.map(Ct),
      i = new Uint32Array(65536),
      c = new Uint32Array(65536),
      f = new Uint16Array(65536)
    for (let u = 0; u < 256; u++)
      for (let a = 0; a < 256; a++) {
        let h = u * 256 + a
        ;((i[h] = n[u] ^ o[a]),
          (c[h] = r[u] ^ s[a]),
          (f[h] = (t[u] << 8) | t[a]))
      }
    return { sbox: t, sbox2: f, T0: n, T1: o, T2: r, T3: s, T01: i, T23: c }
  }
  var fe = je(Ke, (t) => (ce(t, 3) << 24) | (t << 16) | (t << 8) | ce(t, 2))
  var Re = (() => {
    let t = new Uint8Array(16)
    for (let e = 0, n = 1; e < 16; e++, n = Ot(n)) t[e] = n
    return t
  })()
  function Pe(t) {
    A(t)
    let e = t.length
    De(t)
    let { sbox2: n } = fe,
      o = []
    if (!et || !nt(t)) o.push((t = q(t)))
    let r = it(O(t)),
      s = r.length,
      i = (f) => at(n, f, f, f, f),
      c = new Uint32Array(e + 28)
    c.set(r)
    for (let f = s; f < c.length; f++) {
      let u = c[f - 1]
      if (f % s === 0) u = i(Ne(u)) ^ Re[f / s - 1]
      else if (s > 6 && f % s === 4) u = i(u)
      c[f] = c[f - s] ^ u
    }
    return (C(...o), c)
  }
  function gt(t, e, n, o, r, s) {
    return (
      t[((n << 8) & 65280) | ((o >>> 8) & 255)] ^
      e[((r >>> 8) & 65280) | ((s >>> 24) & 255)]
    )
  }
  function at(t, e, n, o, r) {
    return (
      t[(e & 255) | (n & 65280)] |
      (t[((o >>> 16) & 255) | ((r >>> 16) & 65280)] << 16)
    )
  }
  function ie(t, e, n, o, r) {
    let { sbox2: s, T01: i, T23: c } = fe,
      f = 0
    ;((e ^= t[f++]), (n ^= t[f++]), (o ^= t[f++]), (r ^= t[f++]))
    let u = t.length / 4 - 2
    for (let p = 0; p < u; p++) {
      let x = t[f++] ^ gt(i, c, e, n, o, r),
        g = t[f++] ^ gt(i, c, n, o, r, e),
        b = t[f++] ^ gt(i, c, o, r, e, n),
        m = t[f++] ^ gt(i, c, r, e, n, o)
      ;((e = x), (n = g), (o = b), (r = m))
    }
    let a = t[f++] ^ at(s, e, n, o, r),
      h = t[f++] ^ at(s, n, o, r, e),
      l = t[f++] ^ at(s, o, r, e, n),
      d = t[f++] ^ at(s, r, e, n, o)
    return { s0: a, s1: h, s2: l, s3: d }
  }
  function bt(t, e, n, o, r) {
    ;(A(n, It, "nonce"), A(o), (r = ne(o.length, r)))
    let s = n,
      i = O(s),
      c = tt(s),
      f = O(o),
      u = O(r),
      a = e ? 0 : 12,
      h = o.length,
      l = c.getUint32(a, e)
    for (let p = 0; p + 4 <= f.length; p += 4) {
      let {
        s0: x,
        s1: g,
        s2: b,
        s3: m,
      } = ie(t, w(i[0]), w(i[1]), w(i[2]), w(i[3]))
      ;((u[p + 0] = f[p + 0] ^ w(x)),
        (u[p + 1] = f[p + 1] ^ w(g)),
        (u[p + 2] = f[p + 2] ^ w(b)),
        (u[p + 3] = f[p + 3] ^ w(m)),
        (l = (l + 1) >>> 0),
        c.setUint32(a, l, e))
    }
    let d = It * Math.floor(f.length / Oe)
    if (d < h) {
      let {
          s0: p,
          s1: x,
          s2: g,
          s3: b,
        } = ie(t, w(i[0]), w(i[1]), w(i[2]), w(i[3])),
        m = new Uint32Array([p, x, g, b])
      it(m)
      let U = Qt(m)
      for (let B = d, S = 0; B < h; B++, S++) r[B] = o[B] ^ U[S]
      C(m)
    }
    return r
  }
  function ve(t, e, n, o, r) {
    let s = r ? r.length : 0,
      i = t.create(n, o.length + s)
    if (r) i.update(r)
    let c = oe(8 * o.length, 8 * s, e)
    ;(i.update(o), i.update(c))
    let f = i.digest()
    return (C(c), f)
  }
  var ae = ee(
    {
      blockSize: 16,
      nonceLength: 12,
      tagLength: 16,
      withAAD: !0,
      varSizeNonce: !0,
    },
    function (e, n, o) {
      if (n.length < 8) throw Error("aes/gcm: invalid nonce length")
      let r = 16
      function s(c, f, u) {
        let a = ve(_t, !1, c, u, o)
        for (let h = 0; h < f.length; h++) a[h] ^= f[h]
        return a
      }
      function i() {
        let c = Pe(e),
          f = yt.slice(),
          u = yt.slice()
        if ((bt(c, !1, u, u, f), n.length === 12)) u.set(n)
        else {
          let h = yt.slice()
          tt(h).setBigUint64(8, BigInt(n.length * 8), !1)
          let d = _t.create(f).update(n).update(h)
          ;(d.digestInto(u), d.destroy())
        }
        let a = bt(c, !1, u, yt)
        return { xk: c, authKey: f, counter: u, tagMask: a }
      }
      return {
        encrypt(c) {
          let { xk: f, authKey: u, counter: a, tagMask: h } = i(),
            l = new Uint8Array(c.length + r),
            d = [f, u, a, h]
          if (!nt(c)) d.push((c = q(c)))
          bt(f, !1, a, c, l.subarray(0, c.length))
          let p = s(u, h, l.subarray(0, l.length - r))
          return (d.push(p), l.set(p, c.length), C(...d), l)
        },
        decrypt(c) {
          let { xk: f, authKey: u, counter: a, tagMask: h } = i(),
            l = [f, u, h, a]
          if (!nt(c)) l.push((c = q(c)))
          let d = c.subarray(0, -r),
            p = c.subarray(-r),
            x = s(u, h, d)
          if ((l.push(x), !te(x, p)))
            throw (C(...l), Error("aes-gcm: invalid tag"))
          let g = bt(f, !1, a, d)
          return (C(...l), g)
        },
      }
    }
  )
  var Mt = {
    scrypt: Zt,
    hkdf: Jt,
    sha256: st,
    gcm: ae,
    bytesToHex: Pt,
    hexToBytes: vt,
  }
  if (typeof globalThis < "u") globalThis.noble = Mt
  if (typeof self < "u") self.noble = Mt
  if (typeof window < "u") window.noble = Mt
})()
