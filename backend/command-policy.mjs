const CUSTOM_LABEL='Custom Command';

const PRESETS={
  gt06:new Map([
    ['Get Position (Single)','STATUS#'],
    ['Start Live Tracking','TRACK,1#'],
    ['Stop Live Tracking','TRACK,0#'],
    ['Engine On (Immobilizer)','RELAY,1#'],
    ['Engine Off (Immobilizer)','RELAY,0#'],
    ['Enable SOS Alarm','SOS,1#']
  ]),
  teltonika:new Map([
    ['Device info','getinfo'],
    ['Current status','getstatus'],
    ['I/O values','getio'],
    ['Version','getver']
  ])
};

export class CommandValidationError extends Error{
  constructor(message,code='invalid_command_request'){
    super(message);
    this.name='CommandValidationError';
    this.code=code;
    this.status=400;
  }
}

export function commandProtocolFamily(vehicle={}){
  const text=[vehicle.protocol,vehicle.device_model,vehicle.deviceModel,vehicle.metadata?.deviceModel,vehicle.metadata?.model]
    .filter(Boolean).join(' ').toLowerCase();
  if(/teltonika|fmb|fmc/.test(text))return 'teltonika';
  if(/gt06|h9|gx06/.test(text))return 'gt06';
  if(/vylion|viyon/.test(text))return 'vylion';
  if(/concox/.test(text))return 'concox';
  if(/queclink/.test(text))return 'queclink';
  return 'other';
}

export function companyUserCanAccessVehicle(user={},vehicleId){
  if(user.role!=='company_user')return true;
  if(!Array.isArray(user.metadata?.vehicleIds))return false;
  return user.metadata.vehicleIds.some(id=>String(id)===String(vehicleId));
}

export function commandPermissionGranted(user={}){
  return user.role!=='company_user'||user.metadata?.permissions?.Commands===true;
}

export function normalizeCommandRequest(body={},vehicle={},options={}){
  const rawMode=typeof body.mode==='string'?body.mode:'';
  const legacy=!rawMode&&options.allowLegacy===true;
  const mode=legacy?'custom':rawMode;
  if(!['preset','custom'].includes(mode))throw new CommandValidationError('Choose a preset or Custom Command.','invalid_command_mode');

  const command=typeof body.command==='string'?body.command:'';
  if(!command.trim()||command.length>400)throw new CommandValidationError('Enter a command from 1 to 400 characters.','invalid_command_length');
  if(/[\u0000-\u001f\u007f-\u009f]/.test(command))throw new CommandValidationError('Commands must be one line and cannot contain control characters.','invalid_command_characters');

  const family=commandProtocolFamily(vehicle);
  if(mode==='custom'){
    const label=legacy?CUSTOM_LABEL:body.label;
    if(label!==CUSTOM_LABEL)throw new CommandValidationError('Custom commands must use the Custom Command label.','invalid_command_label');
    if(family==='gt06'&&!command.endsWith('#'))throw new CommandValidationError('GT06 / H9 custom commands must end with #.','missing_command_terminator');
    return {command,mode,label:CUSTOM_LABEL,protocol:family};
  }

  const label=typeof body.label==='string'?body.label:'';
  const preset=PRESETS[family]?.get(label);
  if(!preset)throw new CommandValidationError('The selected preset is not available for this tracker protocol.','invalid_command_label');
  if(command!==preset&&!command.startsWith(preset+' '))throw new CommandValidationError('The preset label does not match the command payload.','preset_payload_mismatch');
  return {command,mode,label,protocol:family};
}

export const commandPresetDefinitions=PRESETS;
