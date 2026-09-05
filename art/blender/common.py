"""Shared deterministic painterly models and calibrated 64x32 projection."""
import bpy, math, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

def reset_scene():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        if m.users==0:bpy.data.materials.remove(m)

def material(name,color,roughness=.8,metallic=0,emission=0):
    if isinstance(color,str):
        c=color.lstrip('#'); color=tuple(int(c[i:i+2],16)/255 for i in (0,2,4))
    # Hex colors are supplied in sRGB; transform to scene-linear.
    rgb=tuple(((x+.055)/1.055)**2.4 if x>.04045 else x/12.92 for x in color[:3])
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.75
    tex=n.new('ShaderNodeTexCoord');m.node_tree.links.new(tex.outputs['Generated'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(*(x*.65 for x in rgb),1);ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=(*(min(1,x*1.3+.008) for x in rgb),1)
    m.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0]);m.node_tree.links.new(ramp.outputs['Color'],p.inputs['Base Color'])
    if emission:
        p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m

def mesh(name,vertices,faces,mat):
    d=bpy.data.meshes.new(name);d.from_pydata(vertices,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    if mat:o.data.materials.append(mat)
    return o

def uv(name,loc,scale,mat,segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale
    if mat:o.data.materials.append(mat)
    return o

def box(name,loc,scale,mat,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if mat:o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('soft painted edges','BEVEL');mod.width=bevel;mod.segments=2
        mod=o.modifiers.new('corner normals','WEIGHTED_NORMAL')
    return o

def cone(name,loc,radius1,radius2,depth,mat,vertices=12):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius1,radius2=radius2,depth=depth,location=loc);o=bpy.context.object;o.name=name
    if mat:o.data.materials.append(mat)
    return o

def beam(name,a,b,radius,mat,vertices=10):
    a,b=Vector(a),Vector(b);o=cone(name,(a+b)/2,radius,radius*.88,(b-a).length,mat,vertices);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def curve(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=radius;c.bevel_resolution=2
    sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,v in zip(sp.bezier_points,points):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o)
    if mat:c.materials.append(mat)
    return o

def setup_render(width,height,anchor,samples=32):
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=samples;s.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='OPTIX'
        s.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    except Exception:s.cycles.device='CPU'
    s.render.resolution_x=width;s.render.resolution_y=height;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True;s.render.image_settings.color_depth='8'
    s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
    s.world=bpy.data.worlds.new('soft blue studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.23,.30,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    bpy.ops.object.camera_add(location=(10,-10,10*math.sqrt(2/3)));cam=bpy.context.object;cam.name='calibrated isometric camera';cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=height/(64/math.sqrt(2));s.camera=cam;bpy.context.view_layer.update()
    def px(v):
        q=world_to_camera_view(s,cam,Vector(v));return Vector((q.x*width,(1-q.y)*height))
    # Correct Blender sensor-fit behavior for both landscape and portrait exports.
    span=(px((1,0,0))-px((0,0,0))).x;cam.data.ortho_scale*=span/32;bpy.context.view_layer.update()
    right=cam.rotation_euler.to_matrix()@Vector((1,0,0));up=cam.rotation_euler.to_matrix()@Vector((0,1,0));ppu=64/math.sqrt(2)
    cam.location-=right*((anchor[0]-width/2)/ppu)+up*((height/2-anchor[1])/ppu);bpy.context.view_layer.update()
    origin=px((0,0,0));dx=px((1,0,0))-origin;dy=px((0,-1,0))-origin
    assert (origin-Vector(anchor)).length<.01,(origin,anchor)
    assert (dx-Vector((32,16))).length<.01,dx
    assert (dy-Vector((-32,16))).length<.01,dy
    s['projection_calibration']=str({'origin':list(origin),'x':list(dx),'y':list(dy)})
    for name,loc,energy,size,color in [('warm key',(-3,-5,9),950,5,(1,.86,.66)),('cool fill',(5,1,6),550,5,(.65,.81,1)),('rim',(1,5,8),750,4,(1,.91,.73))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
    return s

def render(path):
    """Render 2x and reduce with alpha-weighted box filtering in linear color."""
    from array import array
    path=os.path.abspath(path);os.makedirs(os.path.dirname(path),exist_ok=True)
    s=bpy.context.scene;w=s.render.resolution_x;h=s.render.resolution_y
    high=path+'.supersample.png';s.render.resolution_percentage=200;s.render.filepath=high
    bpy.ops.render.render(write_still=True)
    src=bpy.data.images.load(high,check_existing=False)
    pixels=array('f',[0])*(w*h*16);src.pixels.foreach_get(pixels)
    reduced=array('f',[0])*(w*h*4)
    for y in range(h):
        for x in range(w):
            i=(y*w*4+x*2)*4;ii=(i,i+4,i+w*8,i+w*8+4)
            aa=[pixels[j+3] for j in ii];total=sum(aa);dst=(y*w+x)*4
            reduced[dst+3]=total*.25
            if total>1e-8:
                for channel in range(3):
                    # Blender byte-image pixels expose encoded sRGB values.
                    linear=0
                    for j,a in zip(ii,aa):
                        c=pixels[j+channel];linear+=(((c+.055)/1.055)**2.4 if c>.04045 else c/12.92)*a
                    linear/=total
                    reduced[dst+channel]=1.055*linear**(1/2.4)-.055 if linear>.0031308 else linear*12.92
    dest=bpy.data.images.new('downsampled render',width=w,height=h,alpha=True,float_buffer=False)
    dest.pixels.foreach_set(reduced)
    s.render.resolution_percentage=100;s.render.filepath=path;dest.filepath_raw=path;dest.file_format='PNG';dest.save()
    bpy.data.images.remove(src);bpy.data.images.remove(dest);os.remove(high)

def save(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)),exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(path))

def calibration_image(path):
    """Disposable rendered projection proof; call only in a fresh test process."""
    reset_scene()
    m=material('calibration white',(1,1,1),emission=1)
    mesh('exact one tile square',[(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0)],[(0,1,2,3)],m)
    s=setup_render(64,32,(32,16),samples=8);s.cycles.use_denoising=False
    render(path)
    im=bpy.data.images.load(os.path.abspath(path),check_existing=False)
    w,h=im.size;pixels=list(im.pixels);coords=[(i%w,i//w) for i,a in enumerate(pixels[3::4]) if a>.1]
    bounds=(min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords))
    assert bounds==(0,0,63,31),bounds
    # Each diamond point must occupy its expected edge; corner regions remain transparent.
    for x,y in [(32,0),(63,16),(32,31),(0,16)]:
        assert any(pixels[((yy*w)+xx)*4+3]>.1 for yy in range(max(0,y-1),min(h,y+2)) for xx in range(max(0,x-1),min(w,x+2))),(x,y)
    for x,y in [(0,0),(63,0),(0,31),(63,31)]:assert pixels[((y*w)+x)*4+3]<.01
    return {'dimensions':[w,h],'alpha_bounds':bounds,'projection':s['projection_calibration']}
