---
description: How to commit, push, and deploy the application
---

## Git Remote

- **Origin**: `https://github.com/Kend150212/neeflow.git`
- **Branch**: `main`
- **DO NOT** use the `asocial` repo — it is deprecated.

## Steps

// turbo-all

1. Stage and commit changes:
```bash
cd /Users/kendao/Desktop/CUSOR/ASocial && git add -A && git status
```

2. Commit with a descriptive message:
```bash
cd /Users/kendao/Desktop/CUSOR/ASocial && git commit -m "your message here"
```

3. Push to neeflow:
```bash
cd /Users/kendao/Desktop/CUSOR/ASocial && git push origin main
```

4. On the server, deploy:
```bash
cd ~/neeflow.com && git pull && npm run build && pm2 restart all
```

## If schema changes were made (Prisma):
```bash
cd ~/neeflow.com && git pull
npx prisma db push
npm run build && pm2 restart all
```
