#! /bin/sh
desktopPath=/opt/野火IM/entries/applications/cn.wildfire.chat.desktop
rootDesktop=/root/Desktop
if [ -d $rootDesktop ]; then
  cp $desktopPath $rootDesktop
fi

users=$(users)
for u in $users; do
  dir=/home/$u/Desktop
  cndir=/home/$u/桌面
  if [ -d $dir ]; then
    cp $desktopPath $dir
    chmod 777 $dir/cn.wildfire.chat.desktop
  fi
  if [ -d $cndir ]; then
    cp $desktopPath $cndir
    chmod 777 $cndir/cn.wildfire.chat.desktop
  fi
done
