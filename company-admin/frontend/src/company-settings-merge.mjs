export const settingsEqual=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

export function sectionValue(company,section){
  const settings=company?.settings||{};
  return {
    root:Object.fromEntries(section.rootKeys.map(key=>[key,company?.[key]??''])),
    settings:Object.fromEntries(section.settingKeys.map(key=>[key,settings[key]]))
  };
}

export function mergeSection(base,source,section){
  const next={...base,settings:{...(base?.settings||{})}};
  for(const key of section.rootKeys)next[key]=source?.[key];
  for(const key of section.settingKeys)next.settings[key]=source?.settings?.[key];
  return next;
}

export function changedKeys(base,draft,section){
  return {
    rootKeys:section.rootKeys.filter(key=>!settingsEqual(base?.[key],draft?.[key])),
    settingKeys:section.settingKeys.filter(key=>!settingsEqual(base?.settings?.[key],draft?.settings?.[key]))
  };
}

export function mergeRemoteWithLocalEdits(previousBaseline,previousDraft,remote,sections){
  let nextDraft=remote;
  const conflicts={};
  for(const section of sections){
    const local=changedKeys(previousBaseline,previousDraft,section);
    const sectionConflicts=[];
    nextDraft={...nextDraft,settings:{...(nextDraft.settings||{})}};
    for(const key of local.rootKeys){
      const remoteChanged=!settingsEqual(previousBaseline?.[key],remote?.[key]);
      if(remoteChanged&&!settingsEqual(previousDraft?.[key],remote?.[key]))sectionConflicts.push(key);
      nextDraft[key]=previousDraft?.[key];
    }
    for(const key of local.settingKeys){
      const remoteChanged=!settingsEqual(previousBaseline?.settings?.[key],remote?.settings?.[key]);
      if(remoteChanged&&!settingsEqual(previousDraft?.settings?.[key],remote?.settings?.[key]))sectionConflicts.push(key);
      nextDraft.settings[key]=previousDraft?.settings?.[key];
    }
    if(sectionConflicts.length)conflicts[section.id]=sectionConflicts;
  }
  return {nextDraft,conflicts};
}

// A conflict remains blocking until the user explicitly discards or saves the
// affected section. Repeated polling of the same remote version cannot clear it.
export const retainConflicts=(current,incoming)=>({...current,...incoming});
