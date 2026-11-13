/**
 * IRIS Pass — Cryptographic Core
 * Compatible with @IRIS/web and @NamelessLiberty/elysia (@noble/hashes, @noble/ciphers)
 */
;(function (root) {
  const IrisCrypto = {}

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const noble =
    root.noble || (typeof globalThis !== "undefined" ? globalThis.noble : null)

  function bytesToHex(bytes) {
    if (noble?.bytesToHex) return noble.bytesToHex(bytes)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  function hexToBytes(hex) {
    if (noble?.hexToBytes) return noble.hexToBytes(hex)
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
  }

  IrisCrypto.bytesToHex = bytesToHex
  IrisCrypto.hexToBytes = hexToBytes

  /**
   * Securely overwrites Uint8Array buffers in memory with zeroes
   */
    // Step 1: Cryptographic Memory Zeroization & Ephemeral Key Generation
  // Step 1.1: Secure In-Memory Buffer Overwriting
  IrisCrypto.zeroize = function (buf) {
    if (buf && (buf instanceof Uint8Array || ArrayBuffer.isView(buf))) {
      buf.fill(0)
    }
  }

  /**
   * Generates a 256-bit cryptographically secure ephemeral key for session isolation
   */
  // Step 1.2: Ephemeral 256-Bit Session Key Generation
  IrisCrypto.generateEphemeralKey = function () {
    return crypto.getRandomValues(new Uint8Array(32))
  }

  const VAULT_SALT = encoder.encode("iris-pass-salt-v1")
  const VAULT_INFO = encoder.encode("iris-pass-vault-v1")

  /**
   * Decrypts the user's master secret key using password with scrypt + AES-256-GCM.
   * Format of encryptedPrivateKey: saltHex:ivHex:authTagHex:cipherHex
   * Exactly matching apps/next/lib/encryption-vault.ts: decryptPrivateKeyClient()
   * and apps/elysia/src/utils/auth-crypto.ts: encryptPrivateKey()
   */
    // Step 2: Key Derivation Pipelines (Scrypt & HKDF)
  // Step 2.1: Master Private Key Decryption via Scrypt + AES-256-GCM
  IrisCrypto.decryptPrivateKey = function (encryptedPayload, password) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const parts = encryptedPayload.split(":")
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted private key format")
    }

    const [saltHex, ivHex, authTagHex, cipherHex] = parts
    if (!saltHex || !ivHex || !authTagHex || !cipherHex) {
      throw new Error("Invalid encrypted private key segment")
    }

    const salt = hexToBytes(saltHex)
    const iv = hexToBytes(ivHex)
    const authTag = hexToBytes(authTagHex)
    const cipher = hexToBytes(cipherHex)

    // Scrypt key derivation (32 bytes AES-256 key, matching Node.js scryptAsync default params)
    const key = noble.scrypt(password.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    // Recombine ciphertext + 16-byte auth tag for @noble/ciphers AES-GCM
    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(key, iv)
    const decrypted = aes.decrypt(ciphertextWithTag)
    IrisCrypto.zeroize(key)
    return decrypted
  }

  /**
   * Derives 256-bit vault key from raw secret key bytes via HKDF-SHA256
   * Exactly matching apps/next/lib/pass-crypto.ts: deriveVaultKey()
   */
  // Step 2.2: Vault Symmetric Key Derivation via HKDF-SHA256
  IrisCrypto.deriveVaultKey = function (unlockedSecretKey) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")
    return noble.hkdf(
      noble.sha256,
      unlockedSecretKey,
      VAULT_SALT,
      VAULT_INFO,
      32
    )
  }

  /**
   * Encrypts plaintext string using AES-256-GCM and VaultKey
   * Format: ivHex:authTagHex:cipherHex
   * Exactly matching apps/next/lib/pass-crypto.ts: encryptVaultData()
   */
    // Step 3: Authenticated Symmetrical Encryption & Decryption (AES-256-GCM)
  // Step 3.1: Plaintext String Encryption & Tag Packing
  IrisCrypto.encryptVaultData = function (plainText, vaultKeyBytes) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plainBytes = encoder.encode(plainText)

    const aes = noble.gcm(vaultKeyBytes, iv)
    const ciphertextWithTag = aes.encrypt(plainBytes)

    const cipher = ciphertextWithTag.slice(0, -16)
    const authTag = ciphertextWithTag.slice(-16)

    return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
  }

  /**
   * Decrypts ivHex:authTagHex:cipherHex using AES-256-GCM and VaultKey
   * Exactly matching apps/next/lib/pass-crypto.ts: decryptVaultData()
   */
  // Step 3.2: Ciphertext Verification & Decryption
  IrisCrypto.decryptVaultData = function (encryptedPayload, vaultKeyBytes) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const parts = encryptedPayload.split(":")
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format")
    }

    const [ivHex, authTagHex, cipherHex] = parts
    if (!ivHex || !authTagHex || !cipherHex) {
      throw new Error("Missing encrypted payload segments")
    }

    const iv = hexToBytes(ivHex)
    const authTag = hexToBytes(authTagHex)
    const cipher = hexToBytes(cipherHex)

    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(vaultKeyBytes, iv)
    const decryptedBytes = aes.decrypt(ciphertextWithTag)

    return decoder.decode(decryptedBytes)
  }

  /**
   * Helper: encrypt JS object to JSON then AES-256-GCM
   */
  IrisCrypto.encryptVaultObject = function (obj, vaultKeyBytes) {
    return IrisCrypto.encryptVaultData(JSON.stringify(obj), vaultKeyBytes)
  }

  /**
   * Helper: decrypt AES-256-GCM to JSON string then parse
   */
  IrisCrypto.decryptVaultObject = function (encryptedPayload, vaultKeyBytes) {
    const json = IrisCrypto.decryptVaultData(encryptedPayload, vaultKeyBytes)
    return JSON.parse(json)
  }

  /**
   * Unbiased random password generator
   */
    // Step 5: Cryptographically Secure Credential Generators
  // Step 5.1: Unbiased Random Password Generator with Ambiguity Filter
  IrisCrypto.generatePassword = function (options = {}) {
    const {
      length = 24,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      avoidAmbiguous = true,
    } = options

    let upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let lower = "abcdefghijklmnopqrstuvwxyz"
    let num = "0123456789"
    let sym = "!@#$%^&*()-_=+[]{}|;:,.<>?"

    if (avoidAmbiguous) {
      upper = upper.replace(/[IO]/g, "")
      lower = lower.replace(/[lo]/g, "")
      num = num.replace(/[01]/g, "")
      sym = sym.replace(/[{}\[\]()\/\\'"`~,;:.<>]/g, "")
    }

    let charset = ""
    const requiredChars = []

    function getCryptoRandomInt(max) {
      if (max <= 0) return 0
      if (max === 1) return 0
      const range = 0x100000000
      const limit = Math.floor(range / max) * max
      const buf = new Uint32Array(1)
      let val
      do {
        crypto.getRandomValues(buf)
        val = buf[0]
      } while (val >= limit)
      return val % max
    }

    if (uppercase && upper.length > 0) {
      charset += upper
      requiredChars.push(upper[getCryptoRandomInt(upper.length)])
    }
    if (lowercase && lower.length > 0) {
      charset += lower
      requiredChars.push(lower[getCryptoRandomInt(lower.length)])
    }
    if (numbers && num.length > 0) {
      charset += num
      requiredChars.push(num[getCryptoRandomInt(num.length)])
    }
    if (symbols && sym.length > 0) {
      charset += sym
      requiredChars.push(sym[getCryptoRandomInt(sym.length)])
    }

    if (!charset) charset = lower || "abcdefghijklmnopqrstuvwxyz"

    const targetLength = Math.max(8, Math.min(256, length))
    const resultChars = []
    for (let i = 0; i < targetLength; i++) {
      resultChars.push(charset[getCryptoRandomInt(charset.length)])
    }

    // Guarantee required characters are included
    for (let i = 0; i < requiredChars.length; i++) {
      resultChars[i] = requiredChars[i]
    }

    // Shuffle in-place using Fisher-Yates with unbiased crypto random
    for (let i = resultChars.length - 1; i > 0; i--) {
      const j = getCryptoRandomInt(i + 1)
      const temp = resultChars[i]
      resultChars[i] = resultChars[j]
      resultChars[j] = temp
    }

    return resultChars.join("")
  }

  function unbiasedRandomInt(max) {
    if (max <= 0 || max === 1) return 0
    const range = 0x100000000
    const limit = Math.floor(range / max) * max
    const buf = new Uint32Array(1)
    let val
    do {
      crypto.getRandomValues(buf)
      val = buf[0]
    } while (val >= limit)
    return val % max
  }

  // Diceware Wordlist (2048 unique words covering a-z, 11 bits of entropy per word)
  const DICEWARE_WORDS = (
    "aback,abbey,abbot,abide,able,abode,abort,about,above,abuse,abyss,acorn,acre,acrobat,act,acting,action,active," +
    "actor,acute,adage,adapt,adder,adept,admit,adobe,adopt,adore,adorn,adult,advance,advent,adverb,advice,aerial,affair," +
    "affect,affirm,afford,afield,aflame,afloat,afraid,afresh,after,again,agate,agency,agenda,agent,agile,aging,aglow,agony," +
    "agree,ahead,aider,aimed,aiming,aired,airing,airman,aisle,ajar,akin,alarm,album,alchemy,alder,alert,algae,alibi," +
    "alien,align,alike,alive,alley,allied,allow,alloy,allude,ally,almond,almost,aloft,aloha,alone,along,aloof,aloud," +
    "alpha,alpine,already,also,altar,alter,amass,amaze,amber,amble,ambush,amend,amid,amigo,amino,amiss,amity,among," +
    "amount,amour,ampere,ample,amplify,amuse,anchor,ancient,android,anew,angel,anger,angle,angry,angst,animal,animate,ankle," +
    "annex,annoy,annul,anode,answer,anthem,anti,antic,anvil,aorta,apart,aphid,apnea,apollo,apparatus,appeal,appear,apple," +
    "apply,apron,aptly,aqua,arbor,arcade,arch,archer,archive,arctic,ardent,ardor,area,arena,argue,arise,armed,armor," +
    "aroma,around,arouse,array,arrive,arrow,arsenal,arson,art,artery,artful,article,artist,ascend,ascent,ash,ashen,ashes," +
    "aside,askew,asleep,aspect,aspen,aspire,assay,assess,asset,assign,assist,assume,assure,aster,astir,astral,astute,athlete," +
    "atlas,atoll,atom,atomic,atone,atrium,attach,attack,attain,attempt,attend,attic,attire,audit,auger,augur,aunt,aura," +
    "aural,aurora,author,auto,autumn,avail,avenge,avenue,averse,avert,aviator,avid,avoid,avow,await,awake,award,aware," +
    "awash,away,awful,awhile,awning,awoke,axial,axiom,axis,axle,azalea,azure," +
    "babble,baboon,baby,backed,backer,backup,bacon,badge,badger,baffle,bagel,baggy,bail,bait,bake,baker,balance,balcony," +
    "balmy,bamboo,banal,banana,band,bandit,banish,banjo,banker,banner,bantam,banter,barber,bard,barely,barge,bark,barley," +
    "barn,baron,barren,barrier,barter,basalt,base,bash,basic,basil,basin,basis,bask,basket,bass,batch,bather,baton," +
    "batter,battle,bauble,bayou,beach,beacon,bead,beagle,beak,beam,bean,bear,beard,beast,beat,beaver,became,beckon," +
    "become,bedding,bedlam,beech,beefy,beehive,beetle,before,befriend,began,beget,beggar,begin,behalf,behave,beheld,behind," +
    "beige,being,belay,belfry,belief,bell,bellow,belly,belong,below,belt,bemoan,bench,bend,beneath,benefit,benign,beret," +
    "berg,berry,berth,beset,beside,bestow,beta,betray,better,bevel,beyond,bias,bib,bible,biceps,bicycle,bidder,bide," +
    "bidet,bigger,bike,bikini,bile,bilge,bill,billet,billow,binary,bind,binge,bingo,biopsy,birch,bird,birth,bison," +
    "biting,bitter,black,blade,blame,bland,blank,blanket,blare,blast,blaze,bleach,bleak,bleat,bleed,bleep,blend,bless," +
    "blight,blimp,blind,blink,bliss,blitz,blizzard,bloat,blob,block,blond,blood,bloom,blossom,blot,blotch,blouse,blown," +
    "blowout,blue,bluebird,bluff,blunt,blur,blurb,blurt,blush,board,boast,boat,bobcat,bode,bodily,body,bogey,boggy," +
    "bogus,boil,boiler,bold,bolster,bolt,bomb,bonanza,bond,bone,bonfire,bonnet,bonsai,bonus,bony,book,boom,boost," +
    "booth,booty,booze,border,bore,bored,borrow,bosom,boss,botany,botch,both,bottle,bottom,bough,bought,boulder,bounce," +
    "bound,bounty,bouquet,bout,bovine,bowel,bower,bowl,boxer,boxing,boyish,brace,bracket,brag,braid,brain,brake,bramble," +
    "bran,branch,brand,brass,bravado,brave,bravo,brawl,brawn,bray,brazen,breach,bread,break,bream,breath,breech,breed," +
    "breeze,brew,briar,bribe,brick,bridal,bride,bridge,bridle,brief,brigade,bright,brim,brine,bring,brink,brisk,broad," +
    "broil,broke,broker,bronco,bronze,brooch,brood,brook,broom,broth,brow,brown,browse,bruise,brunch,brunt,brush,brute," +
    "bubble,buck,bucket,buckle,budge,budget,buff,buffer,buffet,buggy,bugle,build,built,bulb,bulge,bulk,bulky,bull," +
    "bullet,bulletin,bully,bump,bumper,bunch,bundle,bungle,bunk,bunker,bunny,buoy,burden,bureau,burger,burglar,burial,burlap," +
    "burly,burn,burner,burp,burr,burrow,burst,bury,bush,bushel,bushy,bust,bustle,busy,butcher,butler,butter,button," +
    "buyer,buzz,buzzer,bypass,byte," +
    "cabana,cabin,cable,cache,cackle,cactus,caddy,cadence,cadet,cafe,cage,caged,cairn,cake,calcium,caliber,calico,call," +
    "caller,calm,calorie,camel,cameo,camera,camp,camper,campus,canal,canary,cancel,candid,candle,candy,cane,canine,canister," +
    "canker,canned,cannon,cannot,canoe,canon,canopy,cant,canvas,canyon,capable,cape,caper,capital,capon,capsize,capsule,captain," +
    "caption,captive,capture,carat,caravan,carbon,card,careen,career,careful,cargo,carol,carp,carpet,carrot,carry,cart,cartel," +
    "carton,carve,case,cash,cashew,casing,casino,cask,casket,cast,caste,castle,casual,cat,catch,cater,cathedral,cathode," +
    "catnip,cattle,caught,causal,cause,caution,cavalry,cave,cavern,caviar,cavity,caw,cease,cedar,cede,ceiling,celery,celestial," +
    "cell,cellar,cello,cement,censor,census,cent,center,ceramic,cereal,certain,chafe,chaff,chain,chair,chalet,chalk,champ," +
    "champion,chance,change,channel,chant,chaos,chapel,chapter,char,chard,charge,chariot,charity,charm,chart,charter,chase,chasm," +
    "chaste,chat,cheap,cheat,check,cheek,cheep,cheer,cheese,chef,cherry,cherub,chess,chest,chew,chewy,chick,chide," +
    "chief,child,chili,chill,chime,chimney,chimp,chin,china,chip,chirp,chisel,chive,choice,choir,choke,chomp,choose," +
    "chop,chord,chore,chortle,chorus,chose,chosen,chow,chrome,chronicle,chub,chuck,chug,chum,chump,chunk,church,churn," +
    "chute,cider,cigar,cinch,cinema,cipher,circle,circuit,circus,citadel,cite,citizen,citrus,city,civic,civil,clack,clad," +
    "claim,clam,clamp,clan,clang,clank,clap,clapper,claret,clarify,clarity,clash,clasp,class,classic,clatter,clause,claw," +
    "clay,clean,cleanse,clear,cleat,cleave,clef,cleft,clench,clergy,clerk,clever,click,client,cliff,climate,climax,climb," +
    "clinch,cling,clinic,clink,clip,clique,cloak,clock,clod,clog,clone,close,closet,cloth,clothe,cloud,clout,clove," +
    "clover,clown,club,cluck,clue,clump,clumsy,clung,clunk,cluster,clutch,coach,coal,coarse,coast,coat,coax,cobalt," +
    "cobble,cobra,cobweb,cockpit,cocoa,coconut,coddle,code,codex,coffee,coffer,coffin,cog,cogent,cohort,coil,coin,coke," +
    "cold,collar,collect,college,collude,colon,colony,color,colt,column,comb,combat,combine,comedy,comet,comfort,comic,comma," +
    "command,commit,common,compact,company,compare,compass,compel,compile,complex,comply,compose,composer,compound,compress,compute," +
    "comrade,conceal,concede,concept,concern,concert,conch,concise,concord,condemn,condor,conduit,cone,confess,confide,confirm," +
    "conifer,conjure,connect,conquer,conquest,consent,console,consort,constable,consul,consume,contact,contain,content,contest,context," +
    "contour,control,convene,convex,convey,convict,convoy,cook,cookie,cool,cooler,coop,cooper,cope,copied,copier,copper,copy," +
    "coral,cord,cordial,cordon,core,cork,corn,cornea,corner,cornet,corona,corps,correct,corridor,corrode,corrupt,corset,cortex," +
    "cosmic,cosmos,cost,costly,cosy,cot,cottage,cotton,couch,cough,could,council,counsel,count,counter,country,county,couple," +
    "coupon,course,court,cousin,cove,coven,cover,covert,covet,cow,coward,cowboy,cower,cowl,cox,coyote,cozy,crab," +
    "crack,crackle,cradle,craft,crafty,crag,craggy,cram,cramp,cranberry,crane,crank,cranny,crash,crass,crate,crater,crave," +
    "crawl,crayon,craze,crazy,creak,cream,creamy,crease,create,creator,creature,credit,creed,creek,creep,creepy,cremate,creole," +
    "crepe,crept,crescent,crest,crevice,crew,crib,crick,cricket,cried,crime,crimp,crimson,cringe,crinkle,crisis,crisp,crispy," +
    "critic,croak,crock,crocus,croft,crone,crony,crook,crop,cross,crouch,crow,crowd,crown,crude,cruel,cruise,crumb," +
    "crumble,crumpet,crunch,crusade,crush,crust,crux,crypt,crystal,cub,cube,cubic,cubicle,cuckoo,cuddle,cudgel,cue,cuff," +
    "cuisine,cull,culprit,cult,culture,cumin,cup,cupboard,cupid,cupola,curate,curb,curd,curdle,cure,curfew,curio,curl," +
    "curler,curly,currant,current,curry,curse,cursor,curt,curtail,curtain,curve,cushion,cusp,custard,custom,cut,cute,cuticle," +
    "cutlass,cutler,cutoff,cutout,cutter,cycle,cyclone,cygnet,cymbal,cynic,cypress,cyst," +
    "dabble,daddy,daffodil,dagger,dahlia,daily,dainty,dairy,daisy,dale,dally,damage,damask,dame,damn,damp,dampen,damper," +
    "damsel,dance,dancer,dander,dandle,danger,dangle,dank,dapper,dare,daring,dark,darken,darling,darn,dart,dash,dashed," +
    "data,date,datum,daub,daunt,dawn,day,daybreak,daylight,daze,dazzle,deacon,dead,deadly,deaf,deal,dealer,dean," +
    "dear,dearly,dearth,death,debate,debit,debris,debt,debtor,debug,debut,decade,decaf,decal,decay,deceit,decent,decide," +
    "decimal,deck,declare,decline,decode,decor,decoy,decree,deduce,deduct,deed,deem,deep,deepen,deer,defeat,defect,defend," +
    "defer,defiant,define,deflect,deform,defray,deft,defunct,defuse,defy,degree,deign,deity,delay,delete,deli,delight,deliver," +
    "delta,deluge,deluxe,delve,demand,demean,demise,demo,demon,demote,demur,denial,denim,denote,dense,density,dent,dental," +
    "dentist,deny,depart,depend,depict,deploy,deport,depose,deposit,depot,depth,deputy,derail,derby,derive,descend,desert,design," +
    "desire,desk,despair,despise,despite,dessert,destiny,destroy,detach,detail,detain,detect,detent,deter,detest,detour,detract,deuce," +
    "device,devil,devise,devoid,devote,devour,devout,dew,dewy,dial,dialect,dialog,diamond,diaper,diary,dice,dictate,did," +
    "die,diesel,diet,differ,digest,digit,dignity,dike,dilate,dilemma,dill,dilute,dim,dime,dimly,dimple,din,dine," +
    "diner,dinghy,dingo,dingy,dining,dinner,dint,diode,dip,diploma,dipper,direct,dirge,dirigible,dirt,dirty,disc,discard," +
    "discern,disco,dish,disk,dismal,dismay,dismiss,disobey,disown,dispatch,dispel,display,dispute,disrupt,dissect,dissent,distill,distinct," +
    "distort,disturb,ditch,ditto,ditty,diva,dive,diver,diverge,diverse,divert,divest,divide,divine,diving,divisor,divorce,divulge," +
    "dizzy,docile,dock,docket,doctor,dodge,dodger,doe,doer,dogma,doily,doing,dole,doll,dollar,dolphin,domain,dome," +
    "domino,donate,done,donkey,donor,donut,doodle,doom,door,doorway,dope,dorm,dorsal,dosage,dose,dot,dote,double," +
    "doubt,dough,dour,douse,dove,dowdy,dowel,down,downy,dowry,doze,dozen,drab,draft,drag,dragon,drain,drake," +
    "drama,drank,drape,draw,drawer,drawn,dread,dream,dreamy,dreary,dredge,dregs,dress,drew,dribble,dried,drier,drift," +
    "drill,drink,drip,drive,driven,driver,drizzle,droll,drone,drool,droop,drop,droplet,dross,drove,drown,drowse,drug," +
    "drum,drunk,dry,dryer,dryly,dual,dub,ducat,duchess,duck,duct,dude,dudgeon,due,duel,duet,duffel,dug," +
    "duke,dull,duly,dumb,dummy,dump,dumpling,dune,dung,dungeon,dunk,duo,dupe,duplex,durable,during,dusk,dusky," +
    "dust,dusty,dutch,duty,duvet,dwarf,dwell,dwelt,dye,dyed,dying,dynamic,dynamo,dynasty," +
    "eager,eagle,ear,earl,early,earn,earnest,earth,ease,easel,easily,east,eastern,easy,eat,eaten,eater,eaves," +
    "ebb,ebony,echo,eclipse,ecology,economy,eddy,edge,edgy,edible,edict,edifice,edit,edition,editor,educate,eel,eerie," +
    "effect,effigy,effort,egg,eggplant,ego,eight,eighth,eighty,either,eject,elapse,elastic,elate,elbow,elder,elect,elegant," +
    "element,elevate,eleven,elf,elicit,elide,elite,elixir,elk,ellipse,elm,elope,else,elude,elusive,elves,embark,embed," +
    "ember,emblem,embody,emboss,embrace,embryo,emerald,emerge,emery,emit,emotion,emperor,empire,employ,empty,emulate,enable,enact," +
    "enamel,encamp,encase,enchant,enclave,enclose,encode,encore,end,endear,ending,endow,endure,enemy,energy,enforce,engage,engine," +
    "engrave,engulf,enhance,enigma,enjoy,enlarge,enlist,enliven,enmity,enough,enrage,enrich,enroll,ensign,enslave,ensue,ensure,entail," +
    "enter,entice,entire,entity,entomb,entrap,entreat,entry,entropy,envy,enzyme,eon,epic,episode,epoch,equal,equate,equator," +
    "equip,equity,era,erase,eraser,erect,ergo,ermine,erode,erotic,err,errand,erratic,error,erupt,escape,escort,esoteric," +
    "essay,essence,estate,esteem,etch,etching,eternal,ether,ethical,ethics,ethnic,eulogy,evade,evaluate,evasive,eve,even,evening," +
    "event,ever,everest,every,evict,evident,evil,evoke,evolve,ewe,exact,exalt,exam,examine,example,exceed,excel,except," +
    "excess,exchange,excite,exclude,excuse,execute,exempt,exert,exhale,exhaust,exhibit,exhort,exile,exist,exit,exodus,exotic,expand," +
    "expanse,expect,expel,expend,expert,expire,explain,explode,exploit,explore,export,expose,express,extend,extent,extol,extort,extra," +
    "extract,extreme,exude,exult,eye,eyeball,eyebrow,eyelid,eyesight," +
    "fable,fabric,facade,face,facet,facial,facile,fact,factor,factory,factual,fade,fail,faint,fair,fairly,fairy,faith," +
    "fake,falcon,fall,fallen,fallow,false,falter,fame,family,famine,famous,fan,fancy,fang,fantasy,far,farce,fare," +
    "farm,farmer,farther,fast,fasten,fat,fatal,fate,father,fathom,fatigue,fatten,fault,fauna,favor,fawn,fax,fear," +
    "feast,feat,feather,feature,febrile,federal,fee,feeble,feed,feel,feeler,feet,feign,feint,felicity,feline,fell,fellow," +
    "felon,felt,female,femur,fence,fend,fennel,ferment,fern,ferret,ferry,fertile,fervent,fervor,fester,festival,festive,fetch," +
    "fete,fetid,fetter,feud,fever,few,fewer,fiance,fiasco,fiat,fib,fiber,fibula,fickle,fiction,fiddle,fidelity,fidget," +
    "field,fiend,fierce,fiery,fife,fifth,fifty,fig,fight,figure,filament,file,filet,filial,fill,filler,fillet,filly," +
    "film,filmy,filter,filth,filthy,fin,final,finale,finance,finch,find,fine,finely,finery,finger,finish,finite,fir," +
    "fire,firearm,firefly,firm,first,firth,fiscal,fish,fishy,fissure,fist,fit,fitful,five,fix,fixer,fixture,fizz," +
    "fjord,flabby,flack,flag,flagon,flail,flair,flak,flake,flaky,flame,flank,flap,flare,flash,flashy,flask,flat," +
    "flatten,flatter,flaunt,flavor,flaw,flax,flay,flea,fleck,fled,fledge,flee,fleece,fleet,flesh,fleshy,flew,flex," +
    "flick,flight,flimsy,flinch,fling,flint,flip,flirt,flit,float,flock,flood,floor,flop,flora,floral,florid,florist," +
    "floss,flour,flout,flow,flower,flu,flub,flue,fluent,fluff,fluffy,fluid,fluke,flume,flung,flunk,flush,flute," +
    "flutter,flux,fly,flyer,foam,foamy,focal,focus,fodder,foe,fog,foggy,foil,foist,fold,folder,foliage,folk," +
    "follow,folly,fond,fondle,fondly,font,food,fool,foot,forage,foray,forbid,force,ford,fore,foreign,forest,forge," +
    "forget,forgive,fork,form,formal,format,former,formula,fort,forte,forth,fortify,fortress,fortune,forty,forum,forward,fossil," +
    "foster,fought,foul,found,founder,fount,four,fourth,fowl,fox,foxy,foyer,fraction,fragile,fragment,fragrant,frail,frame," +
    "franc,frank,frantic,fraud,fray,freak,freckle,free,freed,freely,freeze,freight,french,frenzy,fresh,fret,friar,fridge," +
    "friend,frieze,fright,frigid,frill,fringe,frisk,frisky,fritter,frizz,frog,frolic,from,frond,front,frost,frosty,froth," +
    "frown,froze,frozen,frugal,fruit,fruity,fry,fudge,fuel,fugue,full,fully,fumble,fume,fun,fund,funeral,fungal," +
    "fungus,funky,funnel,funny,fur,furious,furl,furnace,furnish,furor,furrow,furry,further,fury,fuse,fusion,fuss,fussy," +
    "fusty,futile,future,fuzz,fuzzy," +
    "gabble,gable,gadget,gaffe,gag,gaily,gain,gait,galaxy,gale,gall,gallant,gallery,galley,gallon,gallop,galore,gamble," +
    "game,gamut,gander,gang,gantry,gap,gape,garage,garb,garbage,garden,gargle,gargoyle,garish,garland,garlic,garment,garner," +
    "garnet,garnish,garret,garrison,garter,gas,gash,gasket,gasp,gate,gateway,gather,gauche,gauge,gaunt,gauze,gave,gavel," +
    "gawk,gawky,gay,gaze,gazebo,gazelle,gear,gecko,geezer,geisha,gel,gelatin,gem,gemini,gender,gene,general,generate," +
    "generator,generic,genesis,genial,genie,genius,genre,gentle,gently,gentry,genuine,genus,geode,gerbil,germ,gesture,get,geyser," +
    "ghastly,ghetto,ghost,ghoul,giant,gibbon,giddy,gift,gifted,gig,giggle,gild,gill,gilt,gimlet,ginger,giraffe,gird," +
    "girder,girdle,girl,girth,gist,give,given,giver,gizmo,glacial,glacier,glad,glade,glamour,glance,gland,glare,glass," +
    "glassy,glaze,gleam,glean,glee,gleeful,glen,glib,glide,glider,glimmer,glimpse,glint,glisten,glitch,glitter,gloat,globe," +
    "gloom,gloomy,glory,gloss,glossy,glove,glow,glower,glue,glum,glut,gluten,glutton,gnarled,gnash,gnat,gnaw,gnome," +
    "goad,goal,goat,gobble,goblet,goblin,god,gold,golden,golf,gone,gong,good,goodly,goods,gooey,goof,goofy," +
    "goose,gopher,gore,gorge,gory,gosh,gosling,gospel,gossip,got,gouge,gourd,gourmet,gout,govern,gown,grab,grace," +
    "grade,graft,grail,grain,grainy,gram,grammar,granary,grand,grange,granite,grant,grape,graph,grasp,grass,grassy,grate," +
    "grater,gratis,grave,gravel,gravity,gravy,gray,graze,grease,greasy,great,greed,greedy,green,greet,grew,grey,grid," +
    "grief,grieve,grill,grim,grimace,grime,grimy,grin,grind,grip,gripe,grist,grit,gritty,grizzly,groan,grocer,groin," +
    "groom,groove,grope,gross,grotesque,grotto,grouch,ground,group,grouse,grove,grovel,grow,growl,grown,growth,grub,grubby," +
    "grudge,gruel,gruff,grumble,grump,grumpy,grunt,guano,guard,guardian,guava,guess,guest,guffaw,guide,guild,guile,guilt," +
    "guilty,guise,guitar,gulch,gulf,gull,gullet,gully,gulp,gum,gummy,gun,guppy,gurgle,guru,gush,gust,gusto," +
    "gusty,gut,gutter,guy,guzzle,gym,gypsy,gyro," +
    "habit,habitat,hack,hacker,had,haddock,haft,hag,haggard,haggle,hail,hair,hairy,halcyon,hale,half,hall,hallow," +
    "halo,halt,halter,halve,ham,hamlet,hammer,hammock,hamper,hamster,hand,handle,handy,hang,hangar,hanger,hanker,happen," +
    "happy,harass,harbor,hard,harden,hardly,hardy,hare,harem,hark,harm,harmony,harness,harp,harpoon,harrow,harsh,harvest," +
    "hash,hasp,haste,hasten,hasty,hat,hatch,hatchet,hate,hatred,haughty,haul,haunch,haunt,have,haven,havoc,hawk," +
    "hay,hazard,haze,hazel,hazy,head,header,heal,health,healthy,heap,hear,heard,hearse,heart,hearth,hearty,heat," +
    "heater,heath,heave,heaven,heavy,heckle,hectic,hedge,heed,heel,heft,hefty,height,heinous,heir,held,helix,hello," +
    "helm,helmet,help,helper,helpful,hem,hemlock,hemp,hence,henna,herald,herb,herd,here,heresy,hermit,hero,heroic," +
    "heron,herring,herself,hew,hexagon,heyday,hiatus,hiccup,hickory,hid,hidden,hide,high,highway,hike,hiker,hill,hilly," +
    "hilt,him,himself,hind,hinder,hinge,hint,hip,hippo,hire,hiss,history,hit,hitch,hive,hoard,hoarse,hoax," +
    "hobble,hobby,hobnob,hobo,hockey,hoe,hog,hoist,hold,holder,hole,holiday,hollow,holly,holster,holy,home,homely," +
    "homer,hominy,honest,honey,honk,honor,hood,hoof,hook,hoop,hoot,hop,hope,hopeful,hopper,horde,horizon,horn," +
    "hornet,horror,horse,hose,host,hostel,hostile,hot,hotel,hotly,hound,hour,hourly,house,hovel,hover,how,howdy," +
    "howl,hub,hubbub,huddle,hue,huff,huffy,hug,huge,hulk,hull,hum,human,humane,humble,humbug,humid,humility," +
    "hummingbird,humor,hump,humus,hunch,hundred,hung,hunger,hungry,hunk,hunt,hunter,hurdle,hurl,hurrah,hurricane,hurry,hurt," +
    "husband,hush,husk,husky,hustle,hut,hutch,hyacinth,hybrid,hydra,hyena,hymn,hype,hyper,hyphen," +
    "ibex,ice,icicle,icing,icon,icy,idea,ideal,idiom,idiot,idle,idly,idol,idyll,igloo,ignite,ignore,iguana," +
    "ill,illegal,illness,image,imagine,imbibe,imbue,imitate,immense,immerse,immune,impact,impair,impale,impart,impeach,impede,impel," +
    "impend,implant,implied,implode,implore,imply,import,impose,impress,imprint,improve,impulse,impure,inane,inborn,incense,inch,incise," +
    "incite,incline,include,income,incur,indeed,indent,index,indict,indigo,indoor,induce,indulge,inert,infant,infect,infer,infest," +
    "infidel,infield,inflate,inflect,inflict,influx,inform,infuse,ingest,inhabit,inhale,inherit,inhibit,initial,inject,injure,injury,ink," +
    "inking,inky,inlaid,inland,inlay,inlet,inmate,inn,innate,inner,inning,input,inquest,inquire,inquiry,insect,insert,inside," +
    "insight,insist,inspect,inspire,install,instant,instead,instill,instinct,insult,insure,intact,intake,intend,intense,intent,inter,intern," +
    "intimate,into,intrude,intuit,invade,invalid,invent,invest,invite,invoke,inward,iodine,ion,iris,irk,iron,ironic,irony," +
    "island,isle,isolate,issue,itch,itchy,item,ivory," +
    "jab,jabber,jack,jackal,jacket,jade,jagged,jaguar,jail,jam,jamb,jangle,janitor,jar,jargon,jasmine,jaunt,jaunty," +
    "jaw,jay,jazz,jazzy,jealous,jeans,jeep,jeer,jelly,jerk,jerky,jersey,jest,jester,jet,jetty,jewel,jib," +
    "jibe,jiffy,jig,jiggle,jigsaw,jilt,jingle,jinx,jitter,jive,job,jockey,jog,jogger,join,joint,joist,joke," +
    "joker,jolly,jolt,jostle,jot,journal,joust,jovial,joy,joyful,joyous,judge,jug,juggle,juice,juicy,julep,jumble," +
    "jumbo,jump,jumper,junction,june,jungle,junior,juniper,junk,junket,junta,juror,jury,just,justice,jut,juvenile," +
    "kabob,kale,karma,kayak,keel,keen,keep,keeper,keg,kelp,kennel,kept,kernel,ketchup,kettle,key,khaki,kick," +
    "kid,kidnap,kidney,kill,kiln,kilo,kilt,kin,kind,kindle,kindly,king,kingdom,kink,kinky,kiosk,kiss,kit," +
    "kitchen,kite,kitten,kitty,kiwi,knack,knave,knead,knee,kneel,knelt,knew,knife,knight,knit,knob,knock,knoll," +
    "knot,know,known,knuckle,koala,kudos," +
    "label,labor,lace,lack,lacquer,lad,ladder,ladle,lady,lag,lagoon,laid,lain,lair,lake,lamb,lame,lament," +
    "lamp,lance,land,lane,lank,lantern,lap,lapel,lapse,larch,lard,large,largely,lark,larva,laser,lash,lass," +
    "lasso,last,latch,late,lately,latent,lateral,latex,lathe,lather,latin,latter,lattice,laud,laugh,launch,laundry,lava," +
    "lavish,law,lawful,lawn,lawsuit,lawyer,lax,lay,layer,layman,layout,lazy,leach,lead,leader,leaf,leafy,league," +
    "leak,leaky,lean,leap,learn,lease,leash,least,leather,leave,ledge,ledger,leech,leek,leer,left,leg,legacy," +
    "legal,legend,legion,lemon,lemur,lend,length,lenient,lens,lent,lentil,leopard,leper,less,lessen,lesson,lest,let," +
    "lethal,letter,lettuce,levee,level,lever,levy,lewd,liable,liar,libel,liberal,liberty,library,license,lick,lid,lie," +
    "life,lift,light,like,liken,lilac,lilt,lily,limb,limber,lime,limit,limp,line,linear,linen,liner,linger," +
    "link,lint,lion,lip,liquid,liquor,lisp,list,listen,lit,liter,lithe,litter,little,live,lively,liver,livid," +
    "lizard,load,loaf,loam,loan,loathe,lobby,lobe,lobster,local,locate,lock,locker,locket,locust,lodge,loft,lofty," +
    "log,logic,logo,loin,loiter,loll,lone,lonely,long,look,loom,loon,loop,loose,loosen,loot,lop,lope," +
    "lord,lore,lose,loser,loss,lost,lot,lotion,lottery,lotus,loud,lounge,louse,lousy,lout,love,lovely,lover," +
    "low,lower,lowly,loyal,lucid,luck,lucky,lucre,lug,luggage,lull,lumber,lump,lumpy,lunar,lunch,lung,lunge," +
    "lurch,lure,lurid,lurk,lush,lust,luster,lute,luxury,lynx,lyric," +
    "macaw,mace,machine,macro,mad,madam,made,madly,magic,magma,magnet,magpie,maid,maiden,mail,maim,main,mainly," +
    "maize,major,make,maker,male,malice,mall,mallet,mallow,malt,mammal,mammoth,man,manage,mane,manger,mango,manic," +
    "manly,manner,manor,mantel,mantle,manual,manure,many,map,maple,mar,marble,march,mare,margin,marine,mark,marker," +
    "market,marlin,marmot,maroon,marry,marsh,marten,martial,martin,marvel,mascot,mash,mask,mason,mass,massive,mast,master," +
    "mat,match,mate,matrix,matron,matter,mature,maul,mauve,maven,maxim,may,maybe,mayor,maze,meadow,meager,meal," +
    "mean,meant,meander,measure,meat,meaty,medal,media,medic,medium,medley,meek,meet,meld,mellow,melody,melon,melt," +
    "member,memo,memoir,memory,menace,mend,mental,mention,mentor,menu,mercy,mere,merely,merge,merit,merry,mesa,mesh," +
    "mess,message,messy,met,metal,meteor,meter,method,metric,metro,mew,mica,mice,micro,mid,midday,middle,midge," +
    "midget,midst,might,mighty,mild,mildew,mile,milk,milky,mill,millet,mimic,mince,mind,mine,miner,mineral,mingle," +
    "mini,minimal,mink,minor,mint,minus,minute,mirage,mire,mirror,mirth,misery,misfit,mishap,miss,missile,mist,mistake," +
    "misty,mite,miter,mitten,mix,mixer,moan,moat,mob,mobile,mock,modal,mode,model,modern,modest,modify,module," +
    "mogul,moist,molar,mold,moldy,mole,molten,mom,moment,monarch,money,monk,monkey,month,mood,moody,moon,moor," +
    "moose,moot,mop,mope,moral,morale,morbid,more,morn,moron,morsel,mortal,mortar,mosaic,moss,mossy,most,mostly," +
    "motel,moth,mother,motif,motion,motive,motor,motto,mound,mount,mourn,mouse,mousy,mouth,move,mover,movie,mow," +
    "mower,much,muck,mucus,mud,muddle,muddy,muff,muffin,muffle,mug,muggy,mulch,mule,mull,multi,mumble,mummy," +
    "munch,mural,murky,murmur,muscle,muse,museum,mush,mushy,music,musk,musky,must,mustang,muster,musty,mute,mutiny," +
    "mutter,mutton,mutual,muzzle,myriad,myrrh,myself,mystery,mystic,myth," +
    "nab,nag,nail,naive,naked,name,namely,nanny,nap,napkin,narrow,nasal,nasty,nation,native,nature,naught,nausea," +
    "naval,nave,navel,navy,near,nearby,nearly,neat,neatly,neck,nectar,need,needle,needy,negate,neglect,neigh,neighbor," +
    "neither,neon,nephew,nerd,nerve,nervy,nest,nestle,net,nettle,neural,neuter,never,new,newel,newly,news,newt," +
    "next,nib,nibble,nice,nicely,niche,nick,nickel,niece,night,nimble,nine,ninety,ninja,ninth,nip,nipple,nit," +
    "nitrate,nitro,noble,nobly,nod,node,noise,noisy,nomad,none,noodle,nook,noon,noose,norm,normal,north,nose," +
    "nosy,notch,note,notice,notify,notion,noun,novel,now,nozzle,nuance,nub,nude,nudge,nugget,null,numb,number," +
    "nurse,nut,nutmeg,nylon,nymph," +
    "oak,oaken,oar,oasis,oat,oath,oatmeal,obey,object,oblige,oblong,oboe,obscure,observe,obtain,obtuse,occur,ocean," +
    "ochre,octave,octet,ocular,odd,oddity,oddly,ode,odious,odor,off,offend,offer,office,often,ogle,ogre,oil," +
    "oily,oink,okay,old,olden,older,olive,omega,omen,omit,once,one,onion,only,onset,onto,onward,onyx," +
    "ooze,opal,opaque,open,openly,opera,opiate,opinion,opium,oppose,optic,option,opus,oracle,oral,orange,orator,orbit," +
    "orchard,orchid,order,ore,organ,orient,origin,oriole,ornate,orphan,osprey,ostrich,other,otter,ought,ounce,our,oust," +
    "out,outcry,outdo,outer,outfit,outing,outlaw,outlet,outline,output,outrage,outside,outward,oval,ovary,oven,over,overt," +
    "owe,owing,owl,own,owner,oxen,oxide,oxygen,oyster,ozone," +
    "pace,pack,packer,packet,pact,pad,paddle,paddock,paddy,padlock,pagan,page,pagoda,paid,pail,pain,paint,pair," +
    "palace,palate,pale,palette,pall,pallet,pallid,palm,paltry,pamper,pan,panda,pane,panel,pang,panic,pansy,pant," +
    "panther,pantry,pants,papaya,paper,par,parade,parcel,parch,pardon,pare,parent,parish,park,parlor,parody,parrot,parry," +
    "parse,part,partial,party,pass,pastel,pastor,pastry,pasture,pat,patch,patent,path,patio,patrol,patron,patter,pause," +
    "pave,paw,pawn,pay,peace,peach,peak,peal,peanut,pear,pearl,peasant,peat,pebble,pecan,peck,pedal,peddle," +
    "peek,peel,peep,peer,peg,pelican,pellet,pelt,pen,penal,pencil,pend,pennant,penny,people,pepper,per,perch," +
    "peril,period,perish,perk,perky,permit,person,pert,peruse,pest,pester,pet,petal,petite,petrol,petty,pewter," +
    "phase,pheasant,phial,phlox,phone,phony,photo,phrase,piano,pick,picker,picket,pickle,picnic,pie,piece,pier,pierce," +
    "pig,pigeon,pigment,pike,pile,pilfer,pill,pillar,pillow,pilot,pimp,pin,pinch,pine,ping,pink,pint,pioneer," +
    "pious,pipe,pique,pirate,pistol,piston,pit,pitch,pith,pithy,pity,pivot,pixel,pixie,pizza,place,placid,plague," +
    "plaid,plain,plait,plan,plane,planet,plank,plant,plaque,plasma,plaster,plate,plateau,platter,play,player,plaza,plea," +
    "plead,please,pleat,pledge,plenty,plight,plod,plop,plot,plow,ploy,pluck,plug,plum,plumb,plume,plump,plunder," +
    "plunge,plunk,plural,plus,plush,ply,poach,pocket,pod,poem,poet,poetry,point,poise,poison,poke,poker,polar," +
    "pole,police,policy,polish,polite,polka,poll,pollen,polo,polyp,pomp,pond,ponder,pony,pool,poor,pop,poplar," +
    "poppy,porch,pore,pork,porous,port,portal,porter,portion,pose,posh,posit,posse,post,postal,poster,possum,pot," +
    "potato,potent,potion,potter,pouch,poultry,pounce,pound,pour,pout,powder,power,praise,prance,prank,prawn,pray,preach," +
    "precede,precept,predict,preen,prefab,prefer,prefix,premier,premise,prepare,present,preset,press,presume,pretend,pretty,prevail,prevent," +
    "prey,price,prick,pride,priest,prim,primal,prime,primer,primp,prince,print,prior,prism,prison,privacy,private,prize," +
    "probe,problem,proceed,process,prod,produce,product,profane,profess,profile,profit,program,project,prolong,promise,promote,prompt,prone," +
    "prong,proof,prop,propel,proper,prophet,propose,prose,protect,protein,protest,proud,prove,proverb,provide,prowl,proxy,prude," +
    "prune,pry,psalm,pseudo,psyche,pub,public,publish,puck,pucker,pudding,puddle,puff,puffy,pug,pull,pulley,pulp," +
    "pulpit,pulse,puma,pump,pumpkin,pun,punch,pundit,pungent,punish,punk,punt,puny,pup,pupil,puppet,puppy,pure," +
    "purely,purge,purify,purity,purple,purport,purpose,purr,purse,pursue,push,pushy,pussy,put,putt,putter,puzzle,pygmy," +
    "pylon,python," +
    "quack,quad,quaff,quail,quaint,quake,qualm,quark,quarry,quart,quarter,quartz,quash,quaver,quay,queen,queer,quell," +
    "quench,query,quest,queue,quick,quid,quiet,quill,quilt,quince,quint,quirk,quirky,quit,quite,quiver,quiz,quota," +
    "quote,quoth," +
    "rabbi,rabbit,rabble,rabid,race,racer,rack,racket,radar,radial,radiate,radio,radish,radius,raffle,raft,rafter,rag," +
    "rage,ragged,raid,rail,rain,rainy,raise,rake,rally,ram,ramble,ramp,rampant,rampart,ramrod,ran,ranch,random," +
    "range,ranger,rank,ransom,rant,rap,rapid,raptor,rare,rarely,rarity,rascal,rash,rasp,rat,rate,rather,ratio," +
    "ration,rattle,ravage,rave,ravel,raven,ravenous,ravine,raw,ray,rayon,raze,razor,reach,react,read,reader,ready," +
    "real,reality,realize,really,realm,ream,reap,reaper,rear,reason,rebel,rebound,rebuff,rebuke,recall,recant,recast,recede," +
    "receipt,receive,recent,recess,recipe,recite,reckon,reclaim,recline,recoil,record,recount,recover,recruit,rector,recur,red,redden," +
    "redeem,reduce,reed,reef,reek,reel,refer,refine,reflect,reform,refuge,refund,refuse,refute,regain,regal,regard,regime," +
    "region,regret,regular,reign,rein,reject,rejoice,relapse,relate,relax,relay,release,relent,relic,relief,relieve,relish,relive," +
    "rely,remain,remark,remedy,remind,remit,remnant,remote,remove,rend,render,renew,renown,rent,rental,repair,repeal,repeat," +
    "repel,repent,replace,replay,reply,report,repose,repress,reprint,reproach,reptile,repute,request,require,rescue,research,resemble,resent," +
    "reserve,reside,resign,resin,resist,resolve,resort,respect,respond,rest,restful,restore,restrain,result,resume,retail,retain,retake," +
    "retch,retire,retort,retract,retreat,return,reuse,revamp,reveal,revel,revenge,revenue,revere,reverse,revert,review,revile,revise," +
    "revive,revoke,revolt,revolve,reward,rewind,rhetoric,rhino,rhyme,rhythm,rib,ribbon,rice,rich,richest,richly,rickety,rid," +
    "riddle,ride,rider,ridge,ridicule,rifle,rift,rig,right,rigid,rigor,rile,rim,rind,ring,rink,rinse,riot," +
    "rip,ripe,ripen,ripple,rise,risen,risk,risky,rite,ritual,rival,river,rivet,roach,road,roam,roar,roast," +
    "rob,robber,robe,robin,robot,robust,rock,rocket,rocky,rod,rode,rodent,rodeo,rogue,role,roll,roller,roman," +
    "romp,roof,rook,rookie,room,roomy,roost,rooster,root,rope,rose,rosin,roster,rosy,rot,rotate,rotten,rotund," +
    "rouge,rough,round,rouse,route,rover,row,rowdy,royal,rub,rubber,rubble,ruby,rudder,rude,rudely,rue,ruff," +
    "ruffian,ruffle,rug,rugged,ruin,rule,ruler,rum,rumble,rummage,rumor,rump,rumple,run,rung,runner,runny,runway," +
    "rural,ruse,rush,rust,rustic,rustle,rusty,rut,ruthless," +
    "saber,sable,sabotage,sack,sacred,sad,saddle,sadly,safari,safe,safely,safety,saffron,sag,saga,sage,said,sail," +
    "sailor,saint,sake,salad,salary,sale,saline,sallow,salmon,salon,saloon,salsa,salt,salty,salute,salvage,salve,salvo," +
    "same,sample,sand,sandal,sandy,sane,sang,sanity,sank,sap,sapling,sapphire,sarcasm,sardine,sash,sass,sassy,sat," +
    "satchel,sate,satin,satire,satisfy,satyr,sauce,saucer,saucy,sauna,saunter,savage,save,savor,savory,savvy,saw,sawdust," +
    "sax,say,scab,scaffold,scald,scale,scalp,scam,scamp,scan,scant,scar,scarce,scare,scarf,scarlet,scary,scat," +
    "scatter,scene,scent,scepter,scheme,scholar,school,science,scoff,scold,sconce,scoop,scoot,scope,scorch,score,scorn,scotch," +
    "scour,scout,scowl,scrag,scram,scramble,scrap,scrape,scratch,scrawl,scream,screech,screen,screw,scribble,scribe,scrimp,script," +
    "scroll,scrub,scruff,scrum,scuba,scuff,scull,sculpt,scum,scurry,scurvy,scuttle,scythe,sea,seal,seam,seamy,sear," +
    "search,season,seat,second,secret,sect,sector,secular,secure,sedan,sedate,sedge,see,seed,seedy,seek,seem,seen," +
    "seep,segment,seize,seldom,select,self,sell,seller,semen,send,senior,sense,sensor,sent,sentry,sequel,sequin,serene," +
    "serf,serial,series,serious,sermon,serpent,serum,serve,server,service,sesame,set,settle,seven,sever,several,severe,sew," +
    "sewer,shabby,shack,shade,shadow,shady,shaft,shaggy,shake,shaky,shale,shall,shallow,sham,shame,shampoo,shank,shape," +
    "shard,share,shark,sharp,shatter,shave,shawl,she,sheaf,shear,sheath,shed,sheen,sheep,sheer,sheet,shelf,shell," +
    "shelter,shelve,sheriff,sherry,shield,shift,shifty,shim,shin,shine,shingle,shiny,ship,shirk,shirt,shiver,shoal,shock," +
    "shod,shoddy,shoe,shone,shook,shoot,shop,shore,short,shot,should,shoulder,shout,shove,shovel,show,shower,shown," +
    "showy,shred,shrew,shrewd,shriek,shrift,shrill,shrimp,shrine,shrink,shroud,shrub,shrug,shrunk,shuck,shudder,shuffle,shun," +
    "shunt,shut,shutter,shuttle,shy,shyly,sibling,sick,sicken,sickle,side,sidle,siege,sieve,sift,sigh,sight,sign," +
    "signal,signet,silent,silk,silken,silky,sill,silly,silo,silt,silver,similar,simmer,simple,simply,sin,since,sincere," +
    "sinew,sinful,sing,singe,singer,single,sink,sip,siphon,sir,sire,siren,sirup,sister,sit,site,sitter,six," +
    "sixth,sixty,size,skate,skein,sketch,skew,skewer,ski,skid,skiff,skill,skim,skimp,skimpy,skin,skinny,skip," +
    "skipper,skirt,skit,skulk,skull,skunk,sky,slab,slack,slain,slam,slang,slant,slap,slash,slate,slattern,slaughter," +
    "slave,slay,sled,sledge,sleek,sleep,sleepy,sleet,sleeve,sleigh,slept,slice,slick,slide,slight,slim,slime,slimy," +
    "sling,slink,slip,slipper,slit,slither,sliver,slob,sloe,slog,slogan,slop,slope,sloppy,slosh,slot,sloth,slouch," +
    "slough,slow,slowly,sludge,slug,sluggish,sluice,slum,slumber,slump,slur,slurp,slush,sly,smack,small,smart,smash," +
    "smear,smell,smelly,smelt,smile,smirk,smite,smith,smock,smog,smoke,smoky,smooth,smother,smudge,smug,smuggle,smut," +
    "snack,snafu,snag,snail,snake,snap,snare,snarl,snatch,sneak,sneer,sneeze,snicker,snide,sniff,snip,snipe,sniper," +
    "snippet,snob,snood,snoop,snooze,snore,snorkel,snort,snout,snow,snowy,snub,snuff,snug,snuggle,soak,soap,soapy," +
    "soar,sob,sober,social,sock,socket,sod,soda,sodden,sofa,soft,soften,softly,soggy,soil,solar,sold,solder," +
    "sole,solemn,solid,solo,solve,somber,some,son,sonar,sonata,song,sonic,sonnet,soon,soot,soothe,sooty,sop," +
    "sorbet,sordid,sore,sorrow,sorry,sort,sought,soul,sound,soup,sour,source,south,sow,space,spade,span,spank," +
    "spar,spare,spark,sparkle,sparrow,sparse,spasm,spat,spate,spawn,speak,spear,special,species,speck,speech,speed,speedy," +
    "spell,spend,spent,sperm,sphere,spice,spicy,spider,spigot,spike,spiky,spill,spin,spinach,spinal,spindle,spine,spiny," +
    "spiral,spire,spirit,spit,spite,splash,spleen,splendid,splice,splint,split,spoil,spoke,spoken,sponge,spongy,sponsor,spoof," +
    "spook,spooky,spool,spoon,spore,sport,spot,spouse,spout,sprain,sprang,sprawl,spray,spread,spree,sprig,spring,sprint," +
    "sprite,sprout,spruce,sprung,spry,spud,spume,spun,spunk,spur,spurn,spurt,spy,squab,squad,squall,square,squash," +
    "squat,squaw,squawk,squeak,squeal,squeeze,squelch,squid,squint,squire,squirm,squirt,stab,stable,stack,staff,stag,stage," +
    "stagger,stain,stair,stake,stale,stalk,stall,stamen,stamina,stammer,stamp,stance,stand,staple,star,starch,stare,stark," +
    "start,startle,starve,stash,state,static,statue,stature,status,staunch,stave,stay,steady,steak,steal,steam,steamy,steed," +
    "steel,steep,steer,stem,stench,step,stereo,stern,stew,steward,stick,sticky,stiff,stifle,stigma,stile,still,stilt," +
    "sting,stingy,stink,stint,stir,stitch,stock,stocky,stodgy,stoic,stoke,stole,stolen,stolid,stomp,stone,stony,stood," +
    "stool,stoop,stop,stopper,store,stork,storm,stormy,story,stout,stove,stow,straddle,strafe,straggle,straight,strain,strait," +
    "strand,strange,strap,strata,straw,stray,streak,stream,street,strength,stress,stretch,strew,strict,stride,strife,strike,string," +
    "strip,stripe,strive,strobe,strode,stroke,stroll,strong,strove,struck,strung,strut,stub,stubble,stubborn,stuck,stud,studio," +
    "study,stuff,stuffy,stumble,stump,stun,stung,stunk,stunt,stupid,stupor,sturdy,stutter,style,suave,subdue,subject,submit," +
    "subtle,subtly,suburb,subway,succeed,succumb,such,suck,sucker,sudden,suds,sue,suede,suffer,suffice,sugar,suggest,suit," +
    "suite,suitor,sulk,sulky,sullen,sully,sulfur,sultry,sum,sumac,summary,summer,summit,summon,sun,sunbeam,sundae,sunder," +
    "sundry,sung,sunk,sunny,sunrise,sunset,super,superb,supper,supple,supply,support,suppose,sure,surely,surf,surface,surge," +
    "surly,surmise,surpass,surplus,survey,survive,sushi,suspect,suspend,suture,swab,swaddle,swagger,swallow,swam,swamp,swampy,swan," +
    "swap,swarm,swarthy,swat,swatch,swath,swathe,sway,swear,sweat,sweaty,sweep,sweet,swell,swept,swerve,swift,swig," +
    "swim,swindle,swine,swing,swipe,swirl,swish,swiss,switch,swivel,swollen,swoop,sword,swore,sworn,swum,swung,sycamore," +
    "symbol,symmetry,sympathy,symptom,synod,syntax,syrup,system," +
    "tabby,table,tablet,taboo,tackle,tact,tactic,tag,tail,tailor,taint,take,taken,taker,tale,talent,talk,tall," +
    "tallow,tally,talon,tame,tamper,tan,tandem,tang,tangle,tango,tangy,tank,tanner,tantrum,tap,tape,taper,tapir," +
    "tar,tardy,target,tariff,tarnish,tarot,tarry,tart,tartan,task,tassel,taste,tasty,tatter,tattle,tattoo,taught,taunt," +
    "taupe,taut,tavern,tawny,tax,taxi,tea,teach,teak,teal,team,tear,tease,teaser,tech,tedious,teem,teen," +
    "teens,teeth,teethe,tell,teller,temper,temple,tempo,tempt,ten,tenant,tend,tender,tendon,tenet,tennis,tenor,tense," +
    "tent,tenth,tepid,term,terrace,terrain,terrier,terror,terse,test,testy,tether,text,texture,than,thank,that,thatch," +
    "thaw,the,theater,theft,their,them,theme,then,thence,theory,there,thermal,these,thesis,they,thick,thief,thigh," +
    "thin,thing,think,third,thirst,thirsty,thirty,this,thistle,thong,thorn,thorny,though,thought,thread,threat,three,thresh," +
    "threw,thrice,thrift,thrifty,thrill,thrive,throat,throb,throes,throne,throng,throttle,through,throw,thrown,thrush,thrust,thud," +
    "thug,thumb,thump,thunder,thus,thwack,thwart,thyme,tiara,tibia,tic,tick,ticket,tickle,tidal,tide,tidings,tidy," +
    "tie,tier,tiger,tight,tilde,tile,till,tiller,tilt,timber,time,timid,timing,tin,tinder,tinge,tingle,tinker," +
    "tinkle,tinsel,tint,tiny,tip,tipple,tipsy,tiptoe,tirade,tire,tissue,titan,tithe,title,toad,toady,toast,tobacco," +
    "today,toddle,toe,toffee,toga,toggle,toil,toilet,token,told,toll,tomato,tomb,tome,tomorrow,ton,tonal,tone," +
    "tongs,tonic,tonight,tonsil,too,took,tool,toot,tooth,top,topaz,topic,topple,torch,tore,torment,torn,tornado," +
    "torpedo,torpid,torque,torrent,torso,tortoise,torture,toss,tot,total,totem,totter,touch,tough,tour,tourist,tow,toward," +
    "towel,tower,town,toxic,toxin,toy,trace,track,tract,trade,traffic,tragedy,trail,train,trait,traitor,tram,tramp," +
    "trample,trance,tranquil,transit,trap,trash,trauma,travel,trawl,tray,tread,treat,treaty,treble,tree,trek,trellis,tremble," +
    "tremor,trench,trend,trepid,tress,trial,tribe,trick,tricky,tried,trifle,trigger,trill,trim,trinity,trinket,trio,trip," +
    "tripe,triple,tripod,trite,triumph,trivial,troll,troop,trophy,tropic,trot,trouble,trough,troupe,trout,trowel,truce,truck," +
    "trudge,true,truffle,truly,trump,trumpet,trunk,trust,truth,try,tryst,tub,tuba,tube,tuber,tuck,tuft,tug," +
    "tuition,tulip,tumble,tumid,tummy,tumor,tumult,tuna,tundra,tune,tuner,tunic,tunnel,turban,turbid,turbine,turf,turkey," +
    "turmoil,turn,turnip,turret,turtle,tusk,tussle,tutor,tutu,tuxedo,twang,tweak,tweed,tween,tweet,twerp,twice,twig," +
    "twilight,twin,twine,twinge,twinkle,twirl,twist,twit,twitch,twitter,two,tycoon,tying,type,typhoon,typical,typist,tyrant," +
    "udder,ugly,ulcer,ultra,umber,umbra,umpire,unable,unaware,uncle,uncouth,under,undid,undo,undone,undue,unduly,uneasy," +
    "unfair,unfit,unfold,unify,union,unique,unit,unite,unity,unjust,unkempt,unkind,unless,unlike,unload,unlock,unrest,unsafe," +
    "unseen,unsung,until,unto,untold,untrue,unused,unveil,unwind,unwise,upbeat,update,upheld,uphill,uphold,upkeep,upland,uplift," +
    "upon,upper,uproar,uproot,upset,upshot,upside,uptake,uptown,upward,urban,urchin,urge,urgent,urine,urn,usable,usage," +
    "use,used,useful,user,usher,usual,usually,usurp,utensil,utility,utmost,utter,uvula," +
    "vacant,vacate,vacuum,vagabond,vague,vain,vale,valet,valiant,valid,valley,valor,value,valve,vamp,vampire,van,vandal," +
    "vane,vanilla,vanish,vanity,vapor,vary,vase,vassal,vast,vat,vault,vaunt,veal,vector,veer,vegan,veil,vein," +
    "vellum,velvet,venal,vend,vendor,veneer,venom,vent,venture,venue,veranda,verb,verbal,verdict,verge,verify,vermin,vernal," +
    "verse,version,versus,vertex,verve,very,vesper,vessel,vest,vestige,vet,veteran,veto,vex,vial,vibrant,vicar,vice," +
    "vicinity,victim,victor,victory,video,vie,view,vigil,vigor,vile,villa,village,villain,vine,vinegar,vineyard,vinyl,viola," +
    "violet,violin,viper,viral,virgin,virile,virtual,virtue,virus,visa,visage,vise,vision,visit,visor,vista,visual,vital," +
    "vivid,vixen,vocal,vodka,vogue,voice,void,voile,volatile,volcano,volley,volt,volume,vomit,voodoo,vortex,vote,voter," +
    "vouch,vow,vowel,voyage,vulgar,vulture," +
    "wad,waddle,wade,wafer,waft,wag,wage,wager,wagon,waif,wail,waist,wait,waiter,waive,wake,waken,walk," +
    "walker,wall,wallet,wallop,wallow,walnut,walrus,waltz,wan,wand,wander,wane,want,war,warble,ward,warden,ware," +
    "wares,warm,warmly,warmth,warn,warp,warren,warrior,wart,wary,was,wash,washer,wasp,waste,watch,water,watery," +
    "watt,wave,waver,wavy,wax,waxen,waxy,way,waylay,wayward,weak,weaken,wealth,wean,weapon,wear,weary,weasel," +
    "weather,weave,web,wed,wedge,weed,weedy,week,weekly,weep,weevil,weigh,weight,weird,welcome,weld,welfare,well," +
    "welsh,welt,wench,wend,went,wept,were,west,wet,whack,whale,wharf,what,wheat,wheel,wheeze,whelk,whelm," +
    "whelp,when,whence,where,whether,whey,which,whiff,while,whim,whimper,whimsical,whine,whinny,whip,whir,whirl,whisk," +
    "whisker,whisky,whisper,whist,whistle,white,whiten,whittle,who,whole,wholly,whom,whoop,whose,why,wick,wicked,wicker," +
    "wicket,wide,widely,widen,widow,width,wield,wife,wig,wiggle,wild,wildly,wile,will,willow,wilt,wily,wimp," +
    "win,wince,winch,wind,window,windy,wine,wing,wink,winner,winnow,winter,wintry,wipe,wiper,wire,wiry,wisdom," +
    "wise,wisely,wish,wisp,wispy,wistful,wit,witch,with,wither,within,without,witness,witty,wizard,wizen,wobble,woe," +
    "woeful,wok,woke,woken,wolf,woman,womb,won,wonder,wont,woo,wood,wooden,woody,woof,wool,woolen,woozy," +
    "word,wordy,wore,work,worker,world,worm,wormy,worn,worry,worse,worship,worst,worth,worthy,would,wound,wove," +
    "woven,wow,wrack,wraith,wrangle,wrap,wrapper,wrath,wreak,wreath,wreathe,wreck,wrench,wrest,wrestle,wretch,wriggle,wring," +
    "wrinkle,wrist,writ,write,writer,writhe,written,wrong,wrote,wrung,wry," +
    "xenon,xerox,xylem," +
    "yacht,yahoo,yak,yam,yank,yap,yard,yarn,yawn,year,yearly,yearn,yeast,yell,yellow,yelp,yen,yes," +
    "yet,yew,yield,yodel,yoga,yogi,yoke,yolk,yon,yonder,you,young,your,youth,yowl,yucca,yule,yummy," +
    "zany,zeal,zealot,zealous,zebra,zenith,zephyr,zero,zest,zesty,zigzag,zinc,zing,zip,zipper,zither,zodiac,zombie,zone,zoo,zoom"
  ).split(",")

  /**
   * Diceware passphrase generator
   */
  // Step 5.2: Diceware EFF Passphrase Generator with Separators & Digits
  IrisCrypto.generatePassphrase = function (options = {}) {
    const {
      wordCount = 4,
      separator = "-",
      capitalize = true,
      includeNumber = true,
    } = options

    const count = Math.max(3, Math.min(32, wordCount))
    const randWords = []

    for (let i = 0; i < count; i++) {
      let word = DICEWARE_WORDS[unbiasedRandomInt(DICEWARE_WORDS.length)]
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1)
      }
      randWords.push(word)
    }

    if (includeNumber) {
      const num = unbiasedRandomInt(90) + 10 // 10-99
      const insertIdx = unbiasedRandomInt(randWords.length)
      randWords[insertIdx] = `${randWords[insertIdx]}${num}`
    }

    return randWords.join(separator)
  }
  IrisCrypto.DICEWARE_WORDS = DICEWARE_WORDS

  /**
   * Calculate Shannon entropy in bits
   */
    // Step 6: Shannon Password Entropy & In-Browser SSH Keypair Generation
  // Step 6.1: Shannon Entropy Calculation in Bits
  IrisCrypto.calculateEntropy = function (password) {
    if (!password) return 0
    let pool = 0
    if (/[a-z]/.test(password)) pool += 26
    if (/[A-Z]/.test(password)) pool += 26
    if (/[0-9]/.test(password)) pool += 10
    if (/[^a-zA-Z0-9]/.test(password)) pool += 33
    if (pool === 0) pool = 1
    return Math.round(password.length * (Math.log(pool) / Math.LN2))
  }

  /**
   * Generates Ed25519 or RSA SSH keypair in-browser using WebCrypto
   */
  // Step 6.2: OpenSSH-Compatible Ed25519 & RSA Keypair Generation
  IrisCrypto.generateSshKeypair = async function (algorithm = "ED25519", comment = "user@iris") {
    function encodeSshString(data) {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
      const len = bytes.length
      const res = new Uint8Array(4 + len)
      res[0] = (len >>> 24) & 0xff
      res[1] = (len >>> 16) & 0xff
      res[2] = (len >>> 8) & 0xff
      res[3] = len & 0xff
      res.set(bytes, 4)
      return res
    }

    function concatArrays(arrays) {
      const totalLen = arrays.reduce((acc, curr) => acc + curr.length, 0)
      const res = new Uint8Array(totalLen)
      let offset = 0
      for (const arr of arrays) {
        res.set(arr, offset)
        offset += arr.length
      }
      return res
    }

    function bytesToBase64(bytes) {
      let bin = ""
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return btoa(bin)
    }

    function arrayBufferToPem(buffer, label) {
      const b64 = bytesToBase64(new Uint8Array(buffer))
      const lines = b64.match(/.{1,64}/g) || []
      return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`
    }

    if (algorithm === "ED25519") {
      const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])
      const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
      const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

      const keyType = "ssh-ed25519"
      const openSshBlob = concatArrays([encodeSshString(keyType), encodeSshString(rawPublicKey)])
      const publicKeyOpenSsh = `${keyType} ${bytesToBase64(openSshBlob)} ${comment}`
      const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "PRIVATE KEY")

      const hash = noble ? noble.sha256(openSshBlob) : new Uint8Array(await crypto.subtle.digest("SHA-256", openSshBlob))
      const fingerprintSha256 = `SHA256:${bytesToBase64(hash).replace(/=+$/, "")}`

      return {
        algorithm: "ED25519",
        publicKeyOpenSsh,
        privateKeyPem,
        fingerprintSha256,
      }
    } else {
      const modulusLength = algorithm === "RSA_4096" ? 4096 : 2048
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
      )
      const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
      const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

      function base64UrlToBytes(b64u) {
        const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (b64u.length % 4)) % 4)
        const bin = atob(b64)
        const out = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
        return out
      }

      function encodeSshMpint(rawBytes) {
        let i = 0
        while (i < rawBytes.length && rawBytes[i] === 0) i++
        const trimmed = rawBytes.subarray(i)
        if (trimmed.length === 0) return encodeSshString(new Uint8Array(0))
        if (trimmed[0] & 0x80) {
          const padded = new Uint8Array(trimmed.length + 1)
          padded[0] = 0
          padded.set(trimmed, 1)
          return encodeSshString(padded)
        }
        return encodeSshString(trimmed)
      }

      const keyType = "ssh-rsa"
      const eBytes = base64UrlToBytes(pubJwk.e)
      const nBytes = base64UrlToBytes(pubJwk.n)
      const sshRsaBlob = concatArrays([
        encodeSshString(keyType),
        encodeSshMpint(eBytes),
        encodeSshMpint(nBytes),
      ])

      const publicKeyOpenSsh = `${keyType} ${bytesToBase64(sshRsaBlob)} ${comment}`
      const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "PRIVATE KEY")
      const hash = noble ? noble.sha256(sshRsaBlob) : new Uint8Array(await crypto.subtle.digest("SHA-256", sshRsaBlob))
      const fingerprintSha256 = `SHA256:${bytesToBase64(hash).replace(/=+$/, "")}`

      return {
        algorithm,
        publicKeyOpenSsh,
        privateKeyPem,
        fingerprintSha256,
      }
    }
  }

  /**
   * Set up PIN unlock: derives key via scrypt and encrypts the 256-bit vault key
   */
    // Step 4: Cryptographic PIN Unlock Envelope
  // Step 4.1: PIN Scrypt Key Derivation & Vault Key Wrapping
  IrisCrypto.setupPinUnlock = function (pin, vaultKey) {
    if (!noble) throw new Error("Cryptographic module not loaded")
    if (!pin || pin.length < 4) throw new Error("PIN must be at least 4 characters")

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const pinKey = noble.scrypt(pin.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    const aes = noble.gcm(pinKey, iv)
    const ciphertextWithTag = aes.encrypt(vaultKey)
    IrisCrypto.zeroize(pinKey)
    const cipher = ciphertextWithTag.slice(0, -16)
    const authTag = ciphertextWithTag.slice(-16)

    return {
      saltHex: bytesToHex(salt),
      ivHex: bytesToHex(iv),
      authTagHex: bytesToHex(authTag),
      cipherHex: bytesToHex(cipher),
    }
  }

  /**
   * Unlocks vault key using PIN and saved PIN unlock data
   */
  // Step 4.2: PIN Unwrapping & Key Authentication
  IrisCrypto.unlockWithPin = function (pin, pinData) {
    if (!noble) throw new Error("Cryptographic module not loaded")
    if (!pinData?.saltHex || !pinData?.ivHex || !pinData?.authTagHex || !pinData?.cipherHex) {
      throw new Error("Invalid or missing PIN unlock data")
    }

    const salt = hexToBytes(pinData.saltHex)
    const iv = hexToBytes(pinData.ivHex)
    const authTag = hexToBytes(pinData.authTagHex)
    const cipher = hexToBytes(pinData.cipherHex)

    const pinKey = noble.scrypt(pin.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(pinKey, iv)
    try {
      const decrypted = aes.decrypt(ciphertextWithTag)
      IrisCrypto.zeroize(pinKey)
      return decrypted
    } catch (err) {
      IrisCrypto.zeroize(pinKey)
      throw new Error("Incorrect PIN")
    }
  }

  /**
   * Helper: Base64 encoding/decoding
   */
  IrisCrypto.bytesToBase64 = function (bytes) {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  IrisCrypto.base64ToBytes = function (b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  root.IrisCrypto = IrisCrypto
  if (typeof globalThis !== "undefined") {
    globalThis.IrisCrypto = IrisCrypto
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this
)
