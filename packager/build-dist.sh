#!/bin/sh

set -ex

#npm run build
npm pack
rm -rf dist
mkdir dist
mv pm2-*.tgz dist/pack.tgz

cd dist
tar -xzf pack.tgz --strip 1
rm -rf pack.tgz
npm install --production
cd ..

# First run that print a banner
node dist/bin/pm2 --version

# cleanup
find -name "*~" -delete

# fix chmod
find dist -name LICENSE -type f -exec chmod 755 {} +
find dist -name "*.sh" -type f -exec chmod a+x {} +

tar -cvzf dist/pm2-v`node dist/bin/pm2 --version`.tar.gz dist/*
shasum -a 256 dist/pm2-*.tar.gz
