All four product builds pass at 0d4145cfa768fb47fe21d4d257c8e1ea5d07549a in the isolated assembled-rules401 checkout. Source, test, script, public and configuration inventories match their Git blobs before and after the commands. The protected root preview build was not changed.

The first preparation failed before any build because a node_modules symlink was visible to Git despite the directory ignore. Its receipt is preserved as preparation-first-failure.json. The successful preparation used a real ignored dependency directory with child links.

The first complete suite at the same pin remains failed: 2919 of 2920 checks passed, with one default five-second roster-replay timeout. The root retains its original result and the unchanged isolated nine-test pass separately. The bounded replay-test adjustment and subsequent full rerun do not relabel these build or test records.
