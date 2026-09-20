"""Final modeling details shared by the editable asset generators.

Details are children of the original mesh, in its local coordinates, so every
existing pose, construction visibility flag and collapse transform still applies.
Only named construction parts receive joinery; anatomy and foliage stay clean.
"""
import bpy
from mathutils import Vector


def attach(detail, source):
    detail.parent = source
    detail.hide_render = source.hide_render
    detail['refinement_detail'] = True
    return detail


def trim_material(source):
    name = source.active_material.name.lower() if source.active_material else ''
    # Dwarves and Undead share a palette factory, not their construction style.
    # Bone fittings belong on grave armor and shrouds; brass belongs on Dwarves.
    if ('chest remnant' in source.name.lower() or 'coffin' in source.name.lower()
            or any(k in name for k in ('purple','cloth'))) and 'bone' in bpy.data.materials:
        return bpy.data.materials['bone']
    choices = ('bronze', 'brass', 'gold', 'edge', 'ironlight', 'shellShade', 'stoneLight')
    for key in choices:
        if key in bpy.data.materials:
            return bpy.data.materials[key]
    return source.active_material


def panel_details(obj):
    import common as C
    name = obj.name.lower()
    armor = any(k in name for k in ('breastplate', 'shoulder armor', 'tower shield', 'cheek plate', 'barding', 'ceramic armor', 'barrel shroud', 'chest remnant', 'wrist bracer', 'ceramic greave', 'arm shield', 'ceramic carapace'))
    timber = any(k in name for k in ('timber bed', 'gun carriage', 'oak plank', 'wall plank', 'massive upright', 'supply crate', 'musket stock'))
    architecture = any(k in name for k in ('ceramic wall panel', 'side armor panel', 'riveted chassis', 'coffin bed'))
    if not (armor or timber or architecture):
        return
    bounds = [Vector(p) for p in obj.bound_box]
    lo = Vector([min(p[i] for p in bounds) for i in range(3)])
    hi = Vector([max(p[i] for p in bounds) for i in range(3)])
    size = hi - lo
    axis = min(range(3), key=lambda i: size[i])
    u, v = [i for i in range(3) if i != axis]
    if min(size[u], size[v]) < .12:
        return
    trim = trim_material(obj)
    edge = min(.022, min(size[u], size[v]) * .065)
    center = (hi + lo) / 2
    for sign in (-1, 1):
        def point(a, b, lift=0):
            p = center.copy();p[axis] += sign * (size[axis] / 2 + .007 + lift)
            p[u] += a * size[u];p[v] += b * size[v]
            return tuple(p)
        if armor:
            # A raised rolled border and central chased diamond catch light even
            # at game scale; the broad plate beneath remains the main color.
            border = [point(a,b) for a,b in [(-.34,-.37),(.34,-.37),(.41,-.24),(.41,.28),(.28,.39),(-.28,.39),(-.41,.28),(-.41,-.24),(-.34,-.37)]]
            attach(C.curve('rolled armor border', border, edge, trim), obj)
            diamond = [point(0,.20,.009), point(.17,0,.023), point(0,-.20,.009), point(-.17,0,.023)]
            attach(C.mesh('chased armor lozenge', diamond, [(0,1,2,3)], trim), obj)
        if timber:
            for lane in (-.24, .18):
                attach(C.curve('carved longitudinal wood grain', [point(lane,-.43),point(lane+.035,-.15),point(lane-.025,.13),point(lane+.015,.43)], edge*.35, trim),obj)
        for a in (-.32,.32):
            for b in (-.32,.32):
                if timber and a<0:continue
                attach(C.uv('peened joinery pin',point(a,b,.006),(edge*1.55,)*3,trim),obj)


def cloth_details(obj):
    import common as C
    name = obj.name.lower()
    if not any(k in name for k in ('banner','pennant','shroud','caparison','sail canopy')):
        return
    if len(obj.data.polygons)>5 or obj.get('model_primitive')=='box':return
    counts={}
    for face in obj.data.polygons:
        vertices=list(face.vertices)
        for a,b in zip(vertices,vertices[1:]+vertices[:1]):
            edge=tuple(sorted((a,b)));counts[edge]=counts.get(edge,0)+1
    if not any(m.type=='SOLIDIFY' for m in obj.modifiers):
        mod=obj.modifiers.new('woven cloth thickness','SOLIDIFY');mod.thickness=.012
    for (a,b),count in counts.items():
        if count != 1:continue
        start=obj.data.vertices[a].co;end=obj.data.vertices[b].co
        attach(C.beam('sewn cloth edge',start,end,.008,trim_material(obj),8),obj)


def finish_scene():
    """Idempotent: a second camera setup cannot duplicate model details."""
    bpy.context.view_layer.update()
    originals=list(bpy.context.scene.objects)
    added=0
    for obj in originals:
        if obj.type!='MESH' or obj.get('refinement_detail') or obj.get('refinement_finished'):continue
        obj['refinement_finished']=True
        before=len(bpy.context.scene.objects)
        if obj.get('model_primitive')=='box':panel_details(obj)
        else:cloth_details(obj)
        added+=len(bpy.context.scene.objects)-before
    bpy.context.scene['model_refinement']='2026-09 craftsmanship pass'
    bpy.context.scene['refinement_detail_count']=sum(bool(o.get('refinement_detail')) for o in bpy.context.scene.objects)
    bpy.context.view_layer.update()
