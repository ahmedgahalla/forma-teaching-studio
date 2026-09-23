import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPushToTalk } from './push-to-talk';
import type { SpeechRecognitionLike, SpeechResultEvent } from './speech';
class Recognition implements SpeechRecognitionLike {
  static last: Recognition; lang=''; continuous=false; interimResults=false; maxAlternatives=1;
  onstart: SpeechRecognitionLike['onstart']=null; onresult: SpeechRecognitionLike['onresult']=null; onerror: SpeechRecognitionLike['onerror']=null; onend: SpeechRecognitionLike['onend']=null;
  constructor(){Recognition.last=this;} start=vi.fn(()=>this.onstart?.()); stop=vi.fn(); abort=vi.fn();
}
const event=(text:string,final=true):SpeechResultEvent=>({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});
const setup=()=>{const callbacks={state:vi.fn(),final:vi.fn(),error:vi.fn()};return {callbacks,controller:createPushToTalk(Recognition,callbacks)};};
afterEach(()=>vi.useRealTimers());
describe('push to talk',()=>{
  it('does not submit a final while held; release accepts the final result at end',()=>{const {callbacks,controller}=setup();controller.start();Recognition.last.onresult?.(event('show roots'));expect(callbacks.final).not.toHaveBeenCalled();controller.finish();expect(Recognition.last.stop).toHaveBeenCalledOnce();Recognition.last.onend?.();expect(callbacks.final).toHaveBeenCalledWith('show roots');expect(controller.getState().phase).toBe('idle');controller.dispose();});
  it('accepts results arriving after release without duplicate submissions',()=>{const {callbacks,controller}=setup();controller.start();controller.finish();Recognition.last.onresult?.(event('show roots'));Recognition.last.onresult?.(event('show roots'));Recognition.last.onend?.();expect(callbacks.final).toHaveBeenCalledOnce();controller.dispose();});
  it('cancellation discards late results and end callbacks',()=>{const {callbacks,controller}=setup();controller.start();const result=Recognition.last.onresult,end=Recognition.last.onend;controller.cancel();result?.(event('move tooth eleven'));end?.();expect(callbacks.final).not.toHaveBeenCalled();expect(Recognition.last.abort).toHaveBeenCalledOnce();controller.dispose();});
  it('never executes an interim-only transcript',()=>{const {callbacks,controller}=setup();controller.start();Recognition.last.onresult?.(event('move it',false));controller.finish();Recognition.last.onend?.();expect(callbacks.final).not.toHaveBeenCalled();expect(callbacks.error).toHaveBeenCalled();controller.dispose();});
  it('times out finish and invalidates late provider results',()=>{vi.useFakeTimers();const {callbacks,controller}=setup();controller.start();const end=Recognition.last.onend;controller.finish();vi.advanceTimersByTime(5001);end?.();expect(callbacks.final).not.toHaveBeenCalled();expect(callbacks.error).toHaveBeenCalledOnce();controller.dispose();});
  it('permission failure returns idle without retrying',()=>{const {callbacks,controller}=setup();controller.start();Recognition.last.onerror?.({error:'not-allowed'});expect(controller.getState().phase).toBe('idle');expect(callbacks.error).toHaveBeenCalledWith(expect.stringMatching(/permission|Allow microphone/));controller.dispose();});
  it('unexpected end while held does not execute',()=>{const {callbacks,controller}=setup();controller.start();Recognition.last.onresult?.(event('show roots'));Recognition.last.onend?.();expect(callbacks.final).not.toHaveBeenCalled();controller.dispose();});
  it('defers a fast release until recognition has actually started',()=>{
    vi.useFakeTimers(); class Delayed extends Recognition { start=vi.fn(); }
    const callbacks={state:vi.fn(),final:vi.fn(),error:vi.fn()}, controller=createPushToTalk(Delayed,callbacks);
    controller.start(); const recognition=Recognition.last; controller.finish();
    expect(controller.getState().phase).toBe('finishing'); expect(recognition.stop).not.toHaveBeenCalled();
    recognition.onstart?.(); expect(recognition.stop).toHaveBeenCalledOnce();
    recognition.onresult?.(event('show bone')); recognition.onend?.();
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show bone'); expect(vi.getTimerCount()).toBe(0); controller.dispose();
  });
  it('does not leave a timeout when stop synchronously ends recognition',()=>{
    vi.useFakeTimers(); const {callbacks,controller}=setup(); controller.start(); Recognition.last.onresult?.(event('show roots'));
    Recognition.last.stop.mockImplementation(()=>Recognition.last.onend?.()); controller.finish();
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show roots'); vi.advanceTimersByTime(6000);
    expect(callbacks.error).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0); controller.dispose();
  });
  it('concatenates distinct finalized segments and ignores repeated cumulative delivery',()=>{
    const {callbacks,controller}=setup(); controller.start();
    const results=[Object.assign([{transcript:'show upper jaw'}],{isFinal:true}),Object.assign([{transcript:'then hide gums'}],{isFinal:true})];
    Recognition.last.onresult?.({resultIndex:0,results}); Recognition.last.onresult?.({resultIndex:1,results}); controller.finish(); Recognition.last.onend?.();
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show upper jaw then hide gums'); controller.dispose();
  });
  it('clears a pending finish and discards the previous session after starting another',()=>{
    vi.useFakeTimers(); const {callbacks,controller}=setup(); controller.start(); const old=Recognition.last, result=old.onresult,end=old.onend;
    controller.finish(); controller.cancel(); controller.start(); result?.(event('move tooth eleven')); end?.();
    Recognition.last.onresult?.(event('show labels')); controller.finish(); Recognition.last.onend?.(); vi.advanceTimersByTime(6000);
    expect(callbacks.final).toHaveBeenCalledExactlyOnceWith('show labels'); expect(callbacks.error).not.toHaveBeenCalled(); controller.dispose();
  });
  it('dispose prevents pending timeouts, callbacks and future starts',()=>{
    vi.useFakeTimers(); const {callbacks,controller}=setup(); controller.start(); controller.finish(); const result=Recognition.last.onresult,end=Recognition.last.onend;
    controller.dispose(); callbacks.state.mockClear(); controller.start(); result?.(event('show roots')); end?.(); vi.advanceTimersByTime(6000);
    expect(callbacks.final).not.toHaveBeenCalled(); expect(callbacks.error).not.toHaveBeenCalled(); expect(callbacks.state).not.toHaveBeenCalled();
  });
});
