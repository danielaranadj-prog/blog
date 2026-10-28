const publisherPattern=/^ca-pub-\d{16}$/;
const slotPattern=/^\d{6,20}$/;
const layoutKeyPattern=/^[a-zA-Z0-9_+-]{1,200}$/;

export function adPlacementEnabled(config,placement){
  if(!config?.enabled||!publisherPattern.test(config.publisherId||''))return false;
  if(!['home','article','sidebar','feed'].includes(placement)||!slotPattern.test(config[`${placement}Slot`]||''))return false;
  if(placement==='feed')return config.feedEnabled===true&&layoutKeyPattern.test(config.feedLayoutKey||'');
  return config[`${placement}Enabled`]!==false;
}

// A card follows two stories and needs at least one story after it.
export function showInFeedInGrid(config,count){return count>=3&&adPlacementEnabled(config,'feed');}
