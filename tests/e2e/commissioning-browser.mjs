import assert from 'node:assert/strict';

export default async function verifyConsole({page, origin, fixture, evidence}) {
  const responses = [];
  page.on('response', response => {
    if (response.url().includes('/end-call')) responses.push({url:response.url(),status:response.status()});
  });
  await page.goto(origin+'/admin/demo-operations');
  const card = name => page.locator('details').filter({has:page.getByText('Capture consent · synthetic-browser-'+name,{exact:true})}).locator('..');
  const repeat=card('repeat'), stale=card('stale'), stopped=card('stopped');
  await repeat.getByRole('button',{name:'End call',exact:true}).waitFor();
  for(const row of [repeat,stale,stopped]) {
    await row.locator('summary').first().click();
    for(const label of ['Disclosure version/reference','Evidence reference','Jurisdiction basis']) await row.getByLabel(label,{exact:true}).fill('synthetic');
    for(const action of ['grant','refuse']) assert.equal(await row.getByRole('button',{name:'Record '+action,exact:true}).isDisabled(),true);
  }
  assert.equal(await stopped.getByRole('button',{name:'End call',exact:true}).isDisabled(),true);
  assert.match(await stopped.innerText(),/confirmed by authenticated exact-call hangup/);
  const first=page.waitForResponse(r=>r.url().includes('/end-call'));
  await repeat.getByRole('button',{name:'End call',exact:true}).evaluate(button=>{button.click();button.click();});
  assert.equal((await first).status(),202);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.includes('Repeated requests do not resend')));
  assert.equal(responses.length,1);
  const second=page.waitForResponse(r=>r.url().includes('/end-call'));
  await repeat.getByRole('button',{name:'End call',exact:true}).click();
  assert.equal((await second).status(),202);
  await fixture('bump');
  const rejected=page.waitForResponse(r=>r.url().includes('/end-call'));
  await stale.getByRole('button',{name:'End call',exact:true}).click();
  assert.equal((await rejected).status(),409);
  const count=responses.length;
  const refresh=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/admin/demo-operations'));
  await stopped.getByRole('button',{name:'Refresh disconnection evidence',exact:true}).click();
  await refresh;
  assert.equal(responses.length,count);
  const state=await fixture('inspect');
  assert.equal(state.commands,1);
  assert.equal(state.staleCommands,0);
  assert.equal(state.consentEvents,0);
  assert.equal(state.withdrawn,3);
  assert.equal(state.commandsByType.every(row=>row.command_type==='hangup'),true);
  assert.match(await repeat.innerText(),/Disconnection: not confirmed/);
  await page.screenshot({path:evidence+'/console.png',fullPage:true});
  return {responses,state,checks:['terminal consent remains disabled with filled inputs','STOPPED exact proof disables End call','STOP_PENDING End call','same-turn double click sends once','later duplicate persists one intent','stale generation rejected 409','refresh GET only','no consent reopening']};
};
