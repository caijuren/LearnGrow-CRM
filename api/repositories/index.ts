/**
 * Repository Index - 仓储层统一导出
 * 
 * 职责：提供所有Repository的统一导出入口
 */

export { BaseRepository } from './base.repository.js';
export type { QueryOptions } from './base.repository.js';

export { wxUserRepo } from './wxUser.repository.js';
export type { WxUserRepository } from './wxUser.repository.js';

export { 
  checkinEventRepo, 
  checkinParticipantRepo, 
  checkinRecordRepo 
} from './checkin.repository.js';
export type { 
  CheckinEventRepository, 
  CheckinParticipantRepository, 
  CheckinRecordRepository 
} from './checkin.repository.js';

export { orderRepo } from './order.repository.js';
export type { OrderRepository } from './order.repository.js';

export { productRepo } from './product.repository.js';
export type { ProductRepository } from './product.repository.js';

export { childRepo } from './child.repository.js';
export type { ChildRepository } from './child.repository.js';

export { 
  wechatGroupRepo, 
  wechatGroupMemberRepo 
} from './group.repository.js';
export type { 
  WechatGroupRepository, 
  WechatGroupMemberRepository 
} from './group.repository.js';

export { materialRepo } from './material.repository.js';
export type { MaterialRepository } from './material.repository.js';

export { settingsRepo } from './settings.repository.js';
export type { SettingsRepository } from './settings.repository.js';
