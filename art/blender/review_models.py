"""Inspect saved production models; optionally render large review portraits.

blender --background --factory-startup --python-exit-code 1 \
  --python art/blender/review_models.py -- --portraits
Run portraits after the complete asset generator. Non-rendering inspections can
target completed model IDs with --assets while other assets are exporting.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[1]
sys.path.insert(0,str(BASE))
import common as C


def inspect(portraits=False, repair_actions=False, asset_ids=None):
    out=ROOT/'work/refinement/models';out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'public/assets/manifest.json').read_text())
    files=[]
    for aid,asset in manifest['assets'].items():
        prefix={'unit':'unit','building':'building','environment':'environment'}[asset['kind']]
        files.append((aid,BASE/'scenes'/f'{prefix}-{aid}.blend',asset['kind']))
    files.extend((f'ui-{name}',ROOT/'art/models'/f'ui-{name}.blend','ui') for name in ('halt','hold'))
    if asset_ids:
        unknown=set(asset_ids)-{aid for aid,_,_ in files}
        assert not unknown,f'Unknown model IDs: {unknown}'
        files=[item for item in files if item[0] in asset_ids]
    selected={f'{f}-{r}' for f in ('orc','fairy','dwarf','undead','tideborn','automata') for r in ('melee','cavalry','siege','gate')}
    rows=[]
    for aid,path,kind in files:
        bpy.ops.wm.open_mainfile(filepath=str(path))
        scene=bpy.context.scene
        assert scene.get('model_refinement')=='2026-09 craftsmanship pass',f'Unrefined saved scene: {aid}'
        meshes=[o for o in scene.objects if o.type=='MESH']
        curves=[o for o in scene.objects if o.type=='CURVE']
        details=[o for o in scene.objects if o.get('refinement_detail')]
        assert meshes and scene.camera,f'Incomplete model: {aid}'
        assert all(o.parent for o in details),f'Detached finish detail: {aid}'
        before={o.name for o in scene.objects}
        from refinement import finish_scene
        finish_scene()
        assert before=={o.name for o in scene.objects},f'Finish pass duplicates geometry: {aid}'
        if kind=='unit':
            foreign=[a for a in bpy.data.actions if not a.name.startswith(aid+' / ')]
            if repair_actions:
                for action in foreign:
                    assert action.users<=int(action.use_fake_user),f'Foreign action is still bound: {aid}/{action.name}'
                    bpy.data.actions.remove(action)
                if foreign:C.save(path)
            else:assert not foreign,f'Foreign actions in {aid}: {[a.name for a in foreign]}'
            actions=list(bpy.data.actions)
            for state in ('idle','walk','attack','death'):
                state_actions=[a for a in actions if f' / {state} / ' in a.name]
                assert state_actions,f'Missing {aid} {state} action'
                for action in state_actions:
                    action_curves=[f for layer in action.layers for strip in layer.strips for bag in strip.channelbags for f in bag.fcurves]
                    assert action_curves and all(len(f.keyframe_points)>0 for f in action_curves),f'Empty saved action: {action.name}'
                    assert all(f.data_path in ('location','rotation_euler','scale') for f in action_curves),f'Unexpected action target: {action.name}'
        rows.append({'id':aid,'meshes':len(meshes),'curves':len(curves),'vertices':sum(len(o.data.vertices) for o in meshes),'attachedDetails':len(details),'removedForeignActions':len(foreign) if kind=='unit' and repair_actions else 0})
        if portraits and aid in selected:
            # Preserve the saved camera and pose. More pixels reveal the modeled
            # details without changing lighting, material, or view direction.
            scene.render.resolution_x*=3;scene.render.resolution_y*=3
            scene.cycles.samples=48
            C.render(out/f'{aid}.png')
    report={'models':len(rows),'status':'pass','assets':rows}
    (out/'inventory.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'models':len(rows),'status':'pass'}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--portraits',action='store_true');parser.add_argument('--repair-actions',action='store_true',help='Remove unused foreign actions from scenes exported before the reset_scene cleanup')
    parser.add_argument('--assets',nargs='+',help='Inspect only these completed model IDs')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    inspect(args.portraits,args.repair_actions,args.assets)
