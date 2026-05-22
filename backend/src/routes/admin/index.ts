import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { requireAdmin } from '../../lib/auth';
import { rateLimitMiddleware } from '../../lib/ratelimit';
import adminStats from './stats';
import adminBroadcasts from './broadcasts';
import adminContent from './content';
import adminUploads from './uploads';
import adminMaintenance from './maintenance';
import adminSupporters from './supporters';
import adminUsers from './users';
import adminAchievements from './achievements';

const admin = new Hono<AppEnv>();

admin.use('*', requireAdmin);

// Лёгкий rate-limit на все админские запросы — против взбесившихся скриптов
admin.use('*', rateLimitMiddleware({ name: 'admin:any', limit: 300, windowSec: 60, perUser: true }));

// Жёсткий лимит на загрузку файлов (R2 стоит денег)
admin.use('/uploads/*', rateLimitMiddleware({ name: 'admin:upload', limit: 30, windowSec: 5 * 60, perUser: true }));

// Лимит на публикацию рассылок (спам)
admin.use('/broadcasts', rateLimitMiddleware({ name: 'admin:broadcast', limit: 20, windowSec: 60 * 60, perUser: true }));

admin.route('/stats', adminStats);
admin.route('/broadcasts', adminBroadcasts);
admin.route('/content', adminContent);
admin.route('/uploads', adminUploads);
admin.route('/maintenance', adminMaintenance);
admin.route('/supporters', adminSupporters);
admin.route('/users', adminUsers);
admin.route('/achievements', adminAchievements);

export default admin;
