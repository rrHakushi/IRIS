---
name: IRIS-illustrations
description: Comprehensive design system and generation guide for official IRIS character illustrations and mascot artwork (featuring Iuno / Yuuno from Wuthering Waves). Covers canonical character specifications, framing and safe-margin rules, transparent asset extraction, emotional state palettes, and reactive UI integration across the entire IRIS ecosystem (Auth, Dashboards, Error Pages, Banners, and Empty States). Use whenever creating, generating, modifying, or integrating character illustrations or UI art in IRIS.
---

# IRIS Illustrations System

This skill defines the official character design system, generation standards, and asset integration workflow for the IRIS platform's companion and mascot, **Iuno** (Yuuno) from *Wuthering Waves*.

All illustrations are produced as high-fidelity, isolated full-body anime character renders with pure black backgrounds (`#000000`) for clean alpha transparency extraction, providing consistent, reactive companion artwork across all IRIS web applications, services, and modules.

The master reference image is bundled at:
`[reference.jpg](file:///.agents/skills/IRIS-illustrations/reference.jpg)`

---

## 1. Canonical Character Specifications

Every illustration generated across any feature in the IRIS ecosystem must adhere strictly to Iuno's canonical model:

| Feature | Canonical Specification |
|---|---|
| **Hair** | High twin pigtails with long flowing midnight/sapphire blue hair with lavender/pale-blue inner shading and luminous cyan tips. The hair must **flow naturally downwards** over her shoulders and sides with gravity (not floating high up into the sky). |
| **Bangs** | Distinctive white/silver crescent-shaped streak in her front-left bangs. |
| **Hair Accessories** | Golden laurel/olive leaf wing ornaments pinned on both sides of her head; dark ribbon ties around the pigtail bases. |
| **Eyes & Face** | Expressive violet-indigo iris with starry celestial pupils and subtle pink blush under the lower eyelids; gentle porcelain complexion. |
| **Choker & Halter** | Gold metallic neck choker with an intricate celestial spiral medallion at the hollow of the neck; white crossover halter top revealing the collarbones. |
| **Corset & Waist** | Metallic gold underbust corset band adorned with circular celestial rings; flowing cyan/sapphire gradient waist sashes hanging down behind her with golden bell tassels. |
| **Dress** | Short white pleated Grecian-style mini tunic dress with gold laurel pattern border embroidery along the ruffled hem. |
| **Shorts** | Dark fitted black shorts visible underneath the short white tunic skirt. |
| **Arms & Hands** | Glowing cyan luminescent circular ring bracelets on wrists; gold arm cuffs and white detached sleeve. |
| **Legs & Feet** | Bare slender legs with a gold circular ring band on the right upper thigh; white criss-cross gladiator calf wraps and white/gold strappy sandals. |

---

## 2. Canvas, Framing & Safe Margin Rules

To ensure that character art renders cleanly across cards, modals, hero banners, and empty states without being clipped:

1. **Aspect Ratio**: Use `3:4` (e.g. 768×1024 or 960×1280) or `2:3`. The `3:4` canvas provides the ideal horizontal width for her flowing twin pigtails and sashes.
2. **Safe Margins**:
   - **Right Margin**: At least 15–20% of canvas width in empty black space between the tips of the right pigtail and the right border.
   - **Left Margin**: At least 15% empty black space on the left.
   - **Top Margin**: At least 10% empty black headroom above the top of her hair.
   - **Bottom Margin**: At least 10% empty black space below her sandals.
3. **Full Body Framing**: The entire figure must be 100% visible from the crown of her head to the tips of her sandals.
4. **Background**: Pure solid jet-black (`#000000`) with zero background objects, dials, wheels, or scenery. This enables clean alpha extraction.

---

## 3. Platform Use Cases & State Catalogs

Iuno serves as the visual companion across multiple domains in the IRIS ecosystem:

### A. Authentication & Onboarding (`/auth/*`)
- `login-default.png`: Calm welcoming stance, gentle warm smile, looking directly at the user.
- `login-success.png`: Radiant celebration, playful wink or celebratory peace sign, beaming smile.
- `login-user-not-found.png`: Curious head tilt, finger on chin, gentle searching look.
- `login-invalid-password.png`: Empathetic soft apologetic head shake, soft crossed arms.
- `login-quick-connect.png`: Presenting a floating luminescent cyan digital hologram / celestial rune.
- `register-default.png`: Open arms, warm inviting smile, welcoming a new explorer to IRIS.
- `register-username-taken.png`: Playful apologetic expression, index finger lightly touching cheek.
- `register-email-taken.png`: Soft warning gesture, waving index finger politely towards login.
- `register-password-stage-1.png`: Level 1 / Hesitant, encouraging gentle nod ("Keep going!").
- `register-password-stage-2.png`: Level 2 / Leaning slightly forward, soft supportive smile.
- `register-password-stage-3.png`: Level 3 / Confident smile, hands clasped loosely, nodding in approval.
- `register-password-stage-4.png`: Level 4 / Impressed, bright eyes, thumbs-up / approving gesture.
- `register-password-stage-5.png`: Level 5 / Maximum strength, proud triumphant pose, radiant glowing stars.

### B. System & Status Pages
- `status-404.png`: Astray, holding a celestial lantern or looking through an astrolabe ("Page not found").
- `status-500.png`: Concerned, floating celestial crystal showing slight cracks ("Server glitch").
- `status-429.png`: Gentle palm forward, calm pause gesture ("Hold on, taking a breather").
- `status-maintenance.png`: Sitting peacefully, polishing a golden star or celestial dial ("Under maintenance").

### C. Dashboard & General Features
- `dashboard-welcome.png`: Warm greeting for user dashboard header / home view.
- `dashboard-empty.png`: Peeking gently over an empty container / folder ("Nothing here yet!").
- `settings-security.png`: Holding a golden shield or celestial warding ring (Security center).
- `settings-sessions.png`: Checking holographic device cards (Active sessions).

---

## 4. Generation Prompt Formula

When generating any new asset for the platform using `generate_image`, always pass the bundled reference:
`ImagePaths: [".agents/skills/IRIS-illustrations/reference.jpg"]`

### Master Prompt Template:
```text
Full body standing anime illustration of Iuno from Wuthering Waves on a 3:4 canvas with wide safe margins.
REFERENCE: Strictly preserve the exact face, violet-indigo starry eyes, skin tone, colors, and canon outfit from reference 1:
- Hair: High twin pigtails with long flowing navy blue hair with cyan tips, draped naturally DOWNWARDS over her shoulders and sides with gravity. White crescent streak in front bangs, golden laurel leaf wing hairpins, black ribbon ties.
- Outfit: Gold choker with celestial medallion, white crossover halter top, metallic gold underbust corset band, short pleated white mini tunic dress, fitted black shorts underneath, cyan/blue gradient waist sashes hanging behind her, bare thighs with gold thigh ring, white criss-cross gladiator calf wraps and sandals.

STATE / USE CASE:
- Expression: [Describe emotion, eyes, mouth]
- Pose / Gestures: [Describe arm and hand position, posture]
- Thematic Accents: [e.g. glowing cyan rune, holographic symbol, or clean character only]

FRAMING & BACKGROUND:
- Centered full body, head to toe completely in frame.
- CRITICAL MARGINS: At least 20% empty black space on the right, 15% on the left, 10% top, 10% bottom. No hair tips or limbs touching canvas boundaries.
- PURE SOLID JET-BLACK BACKGROUND (#000000), isolated character only, no background props or dials.
```

---

## 5. Post-Processing & Background Transparency

All generated illustrations use a pure black background (`#000000`) specifically to allow automated, lossless alpha removal.

### Transparency Conversion Script (Python):
```python
from PIL import Image

def convert_to_transparent_png(input_path: str, output_path: str, threshold: int = 10):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    new_data = []
    for r, g, b, a in datas:
        # Transparent if pixel is pitch-black
        if r <= threshold and g <= threshold and b <= threshold:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    img.save(output_path, "PNG")
```

Final assets are placed in the appropriate public asset subdirectories:
- `apps/web/public/images/auth/character/` (Auth state series)
- `apps/web/public/images/status/` (Error and maintenance series)
- `apps/web/public/images/dashboard/` (Dashboard and empty state series)

---

## 6. Frontend UI Integration Pattern

In Next.js React components, use `object-contain` to scale the full-body character cleanly without distortion or cropping:

```tsx
<div className="relative flex items-center justify-center bg-black/40 rounded-xl p-4">
  <Image
    src="/images/auth/character/login-default.png"
    alt="IRIS Companion"
    className="h-full max-h-[560px] w-auto object-contain transition-all duration-300 select-none pointer-events-none"
  />
</div>
```
