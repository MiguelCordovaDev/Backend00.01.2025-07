const { PackageModel, LocationModel, MessageModel } = require('../database/db');

exports.createPackage = async (req, res) => {
  try {
    const { receiver_name, receiver_phone, receiver_address, description, weight } = req.body;
    if (!receiver_name || !receiver_address) return res.status(400).json({ error: 'Datos incompletos' });

    const created = await PackageModel.create({
      sender_id: req.user.id,
      receiver_name,
      receiver_phone,
      receiver_address,
      description,
      weight
    });

    await LocationModel.add(created.id, {
      location_name: 'Paquete creado',
      description: 'Paquete registrado en el sistema',
      status: 'pending'
    });

    res.status(201).json({ message: 'Paquete creado', tracking_number: created.tracking_number, id: created.id });
  } catch (e) {
    console.error('createPackage error:', e);
    res.status(500).json({ error: 'Error creando paquete' });
  }
};

exports.getMyPackages = async (req, res) => {
  try {
    const packages = await PackageModel.getByUser(req.user.id);
    res.json(packages);
  } catch (e) {
    console.error('getMyPackages error:', e);
    res.status(500).json({ error: 'Error obteniendo paquetes' });
  }
};

exports.trackPackage = async (req, res) => {
  try {
    const { tracking } = req.params;
    const pkg = await PackageModel.findByTracking(tracking);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    if (pkg.sender_id !== req.user.id && pkg.courier_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    res.json(pkg);
  } catch (e) {
    console.error('trackPackage error:', e);
    res.status(500).json({ error: 'Error rastreando paquete' });
  }
};

exports.getPackageLocations = async (req, res) => {
  try {
    const { tracking } = req.params;
    const pkg = await PackageModel.findByTracking(tracking);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    if (pkg.sender_id !== req.user.id && pkg.courier_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const locs = await LocationModel.getByPackage(pkg.id);
    res.json(locs);
  } catch (e) {
    console.error('getPackageLocations error:', e);
    res.status(500).json({ error: 'Error obteniendo ubicaciones' });
  }
};

exports.getPackageMessages = async (req, res) => {
  try {
    const { tracking } = req.params;
    const pkg = await PackageModel.findByTracking(tracking);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    if (pkg.sender_id !== req.user.id && pkg.courier_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const msgs = await MessageModel.getByPackage(pkg.id);
    res.json(msgs);
  } catch (e) {
    console.error('getPackageMessages error:', e);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
};

exports.updatePackageStatus = async (req, res) => {
  try {
    const { tracking } = req.params;
    const { status } = req.body;
    const valid = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado inválido' });

    const pkg = await PackageModel.findByTracking(tracking);
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' });

    await PackageModel.updateStatus(pkg.id, status, req.user.id);

    await LocationModel.add(pkg.id, {
      location_name: `Estado: ${status}`,
      description: `Actualizado por ${req.user.username || req.user.display_name || 'courier'}`,
      status
    });

    const { io } = require('../server');
    io.to(`package:${tracking}`).emit('status:updated', { tracking, status, timestamp: new Date() });

    res.json({ message: 'Estado actualizado', status });
  } catch (e) {
    console.error('updatePackageStatus error:', e);
    res.status(500).json({ error: 'Error actualizando estado' });
  }
};