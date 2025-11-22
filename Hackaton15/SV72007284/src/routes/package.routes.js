const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/package.controller');

router.use(requireAuth);

router.post('/', ctrl.createPackage);
router.get('/my-packages', ctrl.getMyPackages);
router.get('/track/:tracking', ctrl.trackPackage);
router.get('/:tracking/locations', ctrl.getPackageLocations);
router.get('/:tracking/messages', ctrl.getPackageMessages);
router.patch('/:tracking/status', requireRole('courier', 'admin'), ctrl.updatePackageStatus);

module.exports = router;