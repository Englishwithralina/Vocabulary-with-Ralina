import test from 'node:test';
import assert from 'node:assert/strict';
import { answer, createSession, hint, sessionResult, resultAfterReview } from '../src/games/engine.js';
const items=[{term:'notebook',meaning:'тетрадь'},{term:'take off',meaning:'взлетать'},{term:'self-aware',meaning:'осознающий себя'},{term:"don't give up",meaning:'не сдавайся'}];
function complete(session, wrong=()=>false) {
  while(session.position<session.queue.length){const q=session.queue[session.position];answer(session,wrong(q)?'incorrect':items[q.index][q.round===0?'meaning':'term']);session.position++;session.answered=false;}return session;
}
test('real four-round totals and perfect result have no review queue',()=>{
  const result=sessionResult(complete(createSession(items)));
  assert.deepEqual(result,{correct:16,total:16,accuracy:100,remaining:[]});
});
test('bounded review removes recalled words and preserves original practice accuracy',()=>{
  const result=sessionResult(complete(createSession(items),q=>q.index<2&&q.round===0));
  assert.equal(result.correct,14);assert.equal(result.accuracy,88);assert.equal(result.remaining.length,2);
  const review=complete(createSession(items,result.remaining),q=>q.index===1);
  const reviewed=resultAfterReview(result,review);
  assert.deepEqual(reviewed.remaining,[1]);assert.deepEqual(reviewed.review,{correct:1,total:2});assert.equal(reviewed.correct,14);assert.equal(reviewed.total,16);assert.equal(reviewed.accuracy,88);
  assert.equal(review.queue.length,2);assert.equal(review.position,2);
  const finished=resultAfterReview(reviewed,complete(createSession(items,reviewed.remaining)));
  assert.deepEqual(finished.remaining,[]);assert.equal(finished.accuracy,88);assert.equal(result.remaining.length,2);
});
test('spelling support has accurate slots and keeps phrase punctuation',()=>{
  assert.equal(hint('notebook'),'n·······');assert.equal(hint('take off'),'t··· o··');
  assert.equal(hint('self-aware'),'s···-·····');assert.equal(hint("don't give up"),"d··'· g··· u·");
});
test('recall accepts edge whitespace and case but rejects changed spelling or punctuation',()=>{
  for(const [index,wrong] of [[1,'takeoff'],[2,'self aware'],[3,'dont give up']]){
    const incorrect=createSession(items,[index]);assert.equal(answer(incorrect,wrong).correct,false);
    const correct=createSession(items,[index]);assert.equal(answer(correct,` ${items[index].term.toUpperCase()} `).correct,true);
  }
});
