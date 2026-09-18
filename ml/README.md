# Honeycomb Image Router

## What this model does
This is the first ML model for the Honeycomb prototype.

It answers:

> **What kind of image did the user submit?**

It does **not** diagnose an allergy or skin condition.

## Starter classes

```text
ingredient_label
product_front
meal_plate
fabric_label
plant_nature
flareup
```

You can add `menu`, `cosmetic`, or `pet_animal` later after the first model works.

## Dataset layout

```text
ml/dataset/
  ingredient_label/
  product_front/
  meal_plate/
  fabric_label/
  plant_nature/
  flareup/
```

For a class assignment, aim for at least **40–60 varied images per class**. More is better.

Vary:
- camera angle
- distance
- lighting
- background
- orientation
- package style / object appearance

Use your own non-sensitive photos or images you have permission to use.

## Install

```bash
cd ml
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Train

```bash
python train_router.py --data ./dataset --epochs 10
```

## Predict

```bash
python predict.py --image path/to/test.jpg
```

## Why this is useful
The prediction can route the user into the right Honeycomb workflow:

```text
photo
 ↓
image router
 ├─ ingredient_label → OCR → ingredient comparison
 ├─ meal_plate       → food recognition / uncertainty
 ├─ fabric_label     → OCR → material comparison
 ├─ plant_nature     → species candidate → exposure info
 ├─ flareup          → reaction journal / context questions
 └─ product_front    → product/barcode lookup
```
