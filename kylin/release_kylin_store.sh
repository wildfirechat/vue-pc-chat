#!/bin/bash
set -e


VERSION=1.0.0
ARCH=mips64el

sudo rm -rf release

mkdir release
cd release
mkdir cn.wildfirechat.pcclient-${VERSION}
cd cn.wildfirechat.pcclient-${VERSION}

mkdir -p opt/apps/cn.wildfirechat.pcclient
mkdir -p usr/share/applications
mkdir -p usr/share/icons


cd usr/share/icons
mkdir -p hicolor/16x16/apps/
mkdir -p hicolor/24x24/apps/
mkdir -p hicolor/32x32/apps/
mkdir -p hicolor/48x48/apps/
mkdir -p hicolor/64x64/apps/
mkdir -p hicolor/128x128/apps/
mkdir -p hicolor/256x256/apps/
mkdir -p hicolor/512x512/apps/
mkdir -p hicolor/1024x1024/apps/
cp -af ../../../../../../build/icons/16x16.png hicolor/16x16/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/24x24.png hicolor/24x24/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/32x32.png hicolor/32x32/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/48x48.png hicolor/48x48/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/64x64.png hicolor/64x64/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/128x128.png hicolor/128x128/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/256x256.png hicolor/256x256/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/512x512.png hicolor/512x512/apps/cn.wildfirechat.pcclient.png
cp -af ../../../../../../build/icons/1024x1024.png hicolor/1024x1024/apps/cn.wildfirechat.pcclient.png

cd ../applications
cp ../../../../../../entries/applications/cn.wildfirechat.pcclient.desktop ./
sed -i 's/files\///g' cn.wildfirechat.pcclient.desktop
cd ../../../opt/apps/cn.wildfirechat.pcclient
cp -af ../../../../../../electron_v10.1.0_kylin_v10/* ./
mv electron cn.wildfirechat.pcclient
mkdir -p resources/extraResources/icons
cp -af ../../../../../../build/icons/* ./resources/extraResources/icons/
cd ../../../

dh_make --createorig -s -y
cd debian

echo "override_dh_auto_build:" >> rules
echo "override_dh_shlibdeps:" >> rules
echo "override_dh_strip:" >> rules

sed -i 's/^Maintainer.*$/Maintainer: imndx <imndxx@wildirechat.cn>/' control
sed -i 's/^Architecture.*$/Architecture: '"$ARCH"'/' control
sed -i 's/^Version.*$/Version: '"$VERSION"'/' control

sed -i 's/<insert up to 60 chars description>/WF IM PC Client/' control
sed -i 's/<insert long description, indented with spaces>/WF IM PC Client/' control
sed -i 's/<insert the upstream URL, if relevant>/https:\/\/wildfirechat.cn/' control

sed -i "1s/.*/cn.wildfirechat.pcclient (${VERSION}) unstable; urgency=medium/" changelog

echo "opt/apps/cn.wildfirechat.pcclient/ /opt/apps" > install
echo "usr/share/ /usr" >> install

rm *.EX *.ex

cd ..
sudo dpkg-buildpackage -rfakeroot -tc -uc -us -b
cd ..
mv cn.wildfirechat.pcclient_${VERSION}_${ARCH}.deb ../
cd ..
sudo rm -rf release
