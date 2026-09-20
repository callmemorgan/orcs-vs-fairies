"""Botanical and weathered forms for the environment models only."""
import math
from mathutils import Vector
import common as C


def branch(name, points, radii, mat, sides=10):
    """A tapered, gently fluted branch swept along a centerline."""
    verts=[]
    for j, point in enumerate(points):
        p=Vector(point)
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize()
        axis=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
        u=tangent.cross(axis).normalized();v=tangent.cross(u).normalized()
        for i in range(sides):
            a=i*math.tau/sides;r=radii[j]*(1+.065*math.sin(i*2.4+j*.4))
            verts.append(tuple(p+(u*math.cos(a)+v*math.sin(a))*r))
    faces=[tuple(range(sides-1,-1,-1))]
    for j in range(len(points)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(points)-1)*sides+i for i in range(sides)))
    obj=C.mesh(name,verts,faces,mat)
    for poly in obj.data.polygons:poly.use_smooth=len(poly.vertices)==4
    return obj


def blade(name, points, widths, mat):
    """Folded, tapering grass or reed blade, with a raised center ridge."""
    verts=[]
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        lateral=tangent.cross(Vector((0,0,1)))
        if lateral.length<.001:lateral=Vector((1,0,0))
        lateral.normalize();p=Vector(p)
        verts.extend([tuple(p-lateral*widths[j]),tuple(p+Vector((0,0,widths[j]*.23))),tuple(p+lateral*widths[j])])
    faces=[]
    for j in range(len(points)-1):
        for side in range(2):a=j*3+side;faces.append((a,a+1,a+4,a+3))
    return C.mesh(name,verts,faces,mat)


def frond(name, start, angle, length, width, mat):
    """Ridged evergreen fan with a saw-toothed edge and a drooping tip."""
    verts=[];steps=12
    for j in range(steps+1):
        t=j/steps;span=width*(math.sin(math.pi*t)**.65)*(.80 if j%2 else 1.08)
        z=.12*length*math.sin(math.pi*t)-.15*length*t*t
        for y,raise_z in ((-span,0),(0,.05*length),(span,0)):
            x=t*length
            verts.append((start[0]+math.cos(angle)*x-math.sin(angle)*y,start[1]+math.sin(angle)*x+math.cos(angle)*y,start[2]+z+raise_z))
    faces=[]
    for j in range(steps):
        a=j*3;faces.extend(((a,a+3,a+4,a+1),(a+1,a+4,a+5,a+2)))
    return C.mesh(name,verts,faces,mat)


def fissure(name, points, mat, width=.008):
    return C.curve(name,points,width,mat)


def leafy_cluster(name, center, size, mats, rng, count=28, proportions=(1,1,1), leaf_scale=1):
    """Overlapping lobed leaves build a broad, irregular layered crown."""
    verts=[];faces=[];colors=[]
    for j in range(count):
        a=j*2.399;layer=j%3;t=(j//3+.5)/math.ceil(count/3);radius=math.sqrt(t)
        ripple=1+.12*math.sin(a*3)+.06*math.cos(a*7)
        p=Vector(center)+Vector((math.cos(a)*radius*size*proportions[0]*ripple,math.sin(a)*radius*size*proportions[1]*ripple,size*(.22*(1-t)-layer*.10+rng.uniform(-.05,.05))))
        # Broad crowns grow in overlapping leaf layers, not spherical shells.
        lean=.25+radius*.65
        normal=Vector((math.cos(a)*lean,math.sin(a)*lean,1)).normalized()
        u=Vector((-math.sin(a),math.cos(a),0));v=normal.cross(u).normalized()
        angle=rng.uniform(-.7,.7);u,v=u*math.cos(angle)+v*math.sin(angle),v*math.cos(angle)-u*math.sin(angle)
        length=size*rng.uniform(.85,1.2)*leaf_scale;width=length*.38
        outline=[(-.55,0),(-.36,-.55),(-.25,-.35),(-.13,-.96),(0,-.62),(.16,-1),(.30,-.55),(.55,0),(.30,.55),(.16,1),(0,.62),(-.13,.96),(-.25,.35),(-.36,.55)]
        base=len(verts)
        verts.append(tuple(p+normal*length*.12))
        verts.extend(tuple(p+u*(x*length)+v*(y*width)) for x,y in outline)
        for i in range(len(outline)):
            faces.append((base,base+1+i,base+1+(i+1)%len(outline)));colors.append(0 if layer==2 else 2 if j%4==0 else 1)
    obj=C.mesh(name,verts,faces,mats[0])
    for mat in mats[1:]:obj.data.materials.append(mat)
    for face,color in zip(obj.data.polygons,colors):face.material_index=color
    return obj
