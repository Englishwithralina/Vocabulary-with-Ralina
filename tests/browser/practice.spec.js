import { test, expect } from '@playwright/test';
const items=[{term:'notebook',meaning:'тетрадь'},{term:'take off',meaning:'взлетать'},{term:'self-aware',meaning:'осознающий себя'},{term:"don't give up",meaning:'не сдавайся'}];
async function mount(page, data={title:'Words for your adventure',unit:'Everyday English',items}){
  // A test-only document has no application entry point or Firebase import.
  // This also prevents Vite hot updates from replacing fixtures with sign-in.
  await page.route('**/__practice_fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module">import "/src/styles.css";</script></body></html>'}));
  await page.goto('/__practice_fixture');
  await page.evaluate(async data=>{const {renderPractice}=await import('/src/features/practice.js');renderPractice(document.querySelector('#app'),data);},data);
}
async function start(page,world){await page.locator(`[name=world][value=${world}]`).check();await page.locator('#begin').click();}
async function respond(page,round,wrong=false){
  const prompt=await page.locator('.prompt').innerText(),item=items.find(x=>x[round===0?'term':'meaning']===prompt),expected=item[round===0?'meaning':'term'];
  await expect(page.locator('#check-answer')).toBeDisabled();
  if(round<2){const choices=page.locator('.answer-option');if(wrong)await choices.filter({hasNotText:expected}).first().click();else await page.getByRole('radio',{name:expected,exact:true}).check();await expect(page.locator('#feedback')).toBeEmpty();}
  else await page.getByLabel('Your answer in English').fill(wrong?'not the spelling':` ${expected.toUpperCase()} `);
  await expect(page.locator('#check-answer')).toBeEnabled();await page.locator('#check-answer').click();await expect(page.locator('#feedback')).toHaveClass(new RegExp(wrong?'incorrect':'correct'));
  await page.locator('#next-question').click();return item;
}
for(const world of ['uk','usa','canada','australia']){
  test(`${world}: four rounds, locked world, accurate spelling support and perfect finish`,async({page})=>{
    await page.setViewportSize({width:world==='canada'?320:world==='australia'?768:1440,height:1000});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await mount(page);await expect(page.locator('#begin')).toBeDisabled();await page.locator('#start').click();await expect(page.locator('#world-heading')).toBeFocused();await start(page,world);
    for(let q=0;q<16;q++){
      const round=Math.floor(q/4);await expect(page.locator('.student-shell')).toHaveClass(new RegExp(`world-${world}`));await expect(page.locator('[name=world]')).toHaveCount(0);
      await expect(page.getByText(`Round ${round+1} of 4`,{exact:true})).toBeVisible();await expect(page.getByText(`Word ${q%4+1} of 4`,{exact:true})).toBeVisible();
      await expect(page.locator('.round-progress li.complete')).toHaveCount(round);
      if(round===2){const prompt=await page.locator('.prompt').innerText(),item=items.find(x=>x.meaning===prompt);await expect(page.locator('.word-hint')).toBeVisible();await expect(page.locator('#answer-form input:not([type=radio])')).toHaveCount(1);if(item.term==='notebook')await expect(page.locator('.letter-slot')).toHaveCount(7);if(item.term==='self-aware')await expect(page.locator('.word-hint')).toContainText('-');if(item.term.includes("'"))await expect(page.locator('.word-hint')).toContainText("'");}
      else await expect(page.locator('.word-hint')).toHaveCount(0);
      if(q%4===0)await page.screenshot({path:`test-results/${world}-round-${round+1}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await respond(page,round);
    }
    await expect(page.getByText('100%',{exact:true})).toBeVisible();await expect(page.getByText('16 / 16',{exact:true})).toBeVisible();await expect(page.locator('#review')).toHaveCount(0);
    await page.screenshot({path:`test-results/${world}-perfect.png`,fullPage:true,animations:'disabled'});
    await page.locator('#finish').click();await expect(page.getByRole('heading',{name:'Your journey is complete.'})).toBeVisible();
    await page.locator('#another-journey').click();await expect(page.locator('#begin')).toBeDisabled();expect(errors).toEqual([]);
  });
}
test('multiple mistakes stay bounded, recall removes them, initial score stays true',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mount(page);await start(page,'usa');
  for(let q=0;q<16;q++)await respond(page,Math.floor(q/4),q<3);
  await expect(page.getByText('81%',{exact:true})).toBeVisible();await expect(page.locator('#review')).toHaveText('Review 3 words →');await page.locator('#review').click();
  await expect(page.getByRole('heading',{name:'Time to review!',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/review-mobile.png',fullPage:true,animations:'disabled'});
  await expect(page.getByText('Word 1 of 3',{exact:true})).toBeVisible();await expect(page.locator('.round-progress li')).toHaveCount(4);await expect(page.locator('.word-hint')).toHaveCount(0);
  await respond(page,4,true);await respond(page,4);await respond(page,4);
  await expect(page.getByText('81%',{exact:true})).toBeVisible();await expect(page.getByText('13 / 16',{exact:true})).toBeVisible();await expect(page.locator('#review')).toHaveText('Review 1 word →');await expect(page.locator('.review-summary')).toContainText('2 / 3 recalled');
  await page.locator('#review').click();await respond(page,4);await expect(page.locator('#review')).toHaveCount(0);await expect(page.locator('.review-summary')).toContainText('No words left to review');await expect(page.getByText('81%',{exact:true})).toBeVisible();
});
test('native keyboard selection, disabled check, long content and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await mount(page);await page.locator('[name=world][value=uk]').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('[name=world][value=usa]')).toBeChecked();await page.locator('#begin').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#check-answer')).toBeDisabled();await page.keyboard.press('Tab');await page.keyboard.press('Space');await expect(page.locator('#check-answer')).toBeEnabled();await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.locator('#feedback')).not.toBeEmpty();await expect(page.locator('#next-question')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.getByText('Word 2 of 4',{exact:true})).toBeVisible();
  await mount(page,{title:'A long practice title '.repeat(7),items:items.map((x,i)=>({...x,meaning:x.meaning+' '+('длинное объяснение '.repeat(12))+i}))});
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await start(page,'australia');await expect(page.locator('.question-card')).toHaveCSS('animation-name','none');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('empty and malformed practices cannot start a broken session',async({page})=>{
  for(const data of [null,{}, {title:'',items},{title:'Invalid',items:[]},{title:'Invalid',items:[null,...items]},{title:'Invalid',items:items.map(x=>({...x,example:{bad:true}}))}]){
    await mount(page,data);await expect(page.getByRole('heading',{name:'This practice isn’t available.'})).toBeVisible();await expect(page.locator('#begin')).toHaveCount(0);
  }
});
