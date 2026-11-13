# Sidebar: three recent apps, then All apps (13 Nov 2026)

App layout v2 (#1637) gave every installed app its own sidebar row; with Waimers' 20 apps the
Apps group pushed Settings far down. The owner chose the earlier behaviour: the three apps this
member opened most recently in this store (the one on screen first), each still its own row with
its pages nested, then "All apps (n)". The compact app bar on app pages stays.

`lib/recent-apps.ts`, its test and `hooks/use-recent-apps.ts` come back from before #1637 (with
#1629's per-store, per-member key). New copy: `navigationContent.allApps` (+ Hindi).
