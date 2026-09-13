import {describe,it,expect} from 'vitest';
import {FrameCollector,type FrameMetadata} from '../src/qa/performance';
const frame=():FrameMetadata=>({units:{alive:100,visible:100,onScreen:100},viewport:{width:1920,height:1080},canvas:{width:1920,height:1080},drawingBuffer:{width:2880,height:1620},devicePixelRatio:1.5,renderDensity:1.5,documentVisible:true,artLoaded:true,paused:false});
function sample(metadata:FrameMetadata){const c=new FrameCollector(0,16);c.record(0,metadata);c.record(16,metadata);return c.summary();}
describe('native-density performance evidence',()=>{
 it('accepts a native-density buffer without changing the CSS viewport requirement',()=>expect(sample(frame()).valid).toBe(true));
 it('rejects a low-resolution buffer stretched over a high-density viewport',()=>{const m=frame();m.drawingBuffer={width:1920,height:1080};expect(sample(m).invalidReasons).toContain('drawingBuffer did not match the 1920×1080 viewport and render density');});
 it('rejects density changes within a sample',()=>{const c=new FrameCollector(0,32),m=frame();c.record(0,m);c.record(16,m);c.record(32,{...m,renderDensity:2,drawingBuffer:{width:3840,height:2160}});expect(c.summary().invalidReasons).toContain('Render density changed during sampling');});
});
