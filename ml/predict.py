import argparse, torch
from PIL import Image
from torchvision import transforms, models
from torch import nn

ap=argparse.ArgumentParser()
ap.add_argument("--image",required=True)
ap.add_argument("--model",default="honeycomb_router.pt")
args=ap.parse_args()

ckpt=torch.load(args.model,map_location="cpu")
classes=ckpt["classes"]
model=models.mobilenet_v3_small(weights=None)
model.classifier[3]=nn.Linear(model.classifier[3].in_features,len(classes))
model.load_state_dict(ckpt["state_dict"])
model.eval()

tfm=transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize([.485,.456,.406],[.229,.224,.225])
])
x=tfm(Image.open(args.image).convert("RGB")).unsqueeze(0)
with torch.no_grad():
    probs=torch.softmax(model(x),1)[0]
idx=int(probs.argmax())
print({"class":classes[idx],"confidence":round(float(probs[idx]),4)})
