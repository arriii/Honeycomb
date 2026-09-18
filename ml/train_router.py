import argparse, json
from pathlib import Path
import torch
from torch import nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--data",required=True)
    ap.add_argument("--epochs",type=int,default=10)
    ap.add_argument("--batch-size",type=int,default=16)
    args=ap.parse_args()

    tfm=transforms.Compose([
        transforms.Resize((224,224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(8),
        transforms.ColorJitter(brightness=.15,contrast=.15),
        transforms.ToTensor(),
        transforms.Normalize([.485,.456,.406],[.229,.224,.225])
    ])
    ds=datasets.ImageFolder(args.data,transform=tfm)
    n_val=max(1,int(len(ds)*.2)); n_train=len(ds)-n_val
    train_ds,val_ds=random_split(ds,[n_train,n_val],generator=torch.Generator().manual_seed(42))
    train=DataLoader(train_ds,batch_size=args.batch_size,shuffle=True)
    val=DataLoader(val_ds,batch_size=args.batch_size)
    device="cuda" if torch.cuda.is_available() else "cpu"
    print("device:",device)
    model=models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    for p in model.features.parameters(): p.requires_grad=False
    model.classifier[3]=nn.Linear(model.classifier[3].in_features,len(ds.classes))
    model=model.to(device)
    loss_fn=nn.CrossEntropyLoss()
    opt=torch.optim.Adam(model.classifier.parameters(),lr=1e-3)

    best=0.0
    for epoch in range(args.epochs):
        model.train()
        for x,y in train:
            x,y=x.to(device),y.to(device)
            opt.zero_grad()
            loss=loss_fn(model(x),y)
            loss.backward()
            opt.step()
        model.eval(); correct=total=0
        with torch.no_grad():
            for x,y in val:
                x,y=x.to(device),y.to(device)
                pred=model(x).argmax(1)
                correct+=(pred==y).sum().item(); total+=y.numel()
        acc=correct/max(total,1)
        print(f"epoch {epoch+1}: val_acc={acc:.3f}")
        if acc>best:
            best=acc
            torch.save({"state_dict":model.state_dict(),"classes":ds.classes},"honeycomb_router.pt")

    Path("classes.json").write_text(json.dumps(ds.classes,indent=2))
    print("best validation accuracy:",round(best,3))
    print("saved honeycomb_router.pt and classes.json")

if __name__=="__main__":
    main()
