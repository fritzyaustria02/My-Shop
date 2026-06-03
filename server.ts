import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { Database, hashPassword } from './src/server/db';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-obsidian-epic-marketplace-key-999';

// Increase body payload size limit to accept base64-encoded image files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// JWT authentication middleware for admin actions
function authenticateAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string };
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired session token' });
  }
}

// ======================== API ROUTES ========================

// 1. Healthcheck Checkpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Admin Authentication (Login Only, No Signups for simple security)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await Database.getAdminByUsername(username);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const hashedInput = hashPassword(password);
    if (admin.passwordHash !== hashedInput) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate JWT token valid for 24 hours
    const token = jwt.sign({ username: admin.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      username: admin.username
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server login handler error', details: error.message });
  }
});

// 3. Public: Fetch Applet State/Assets
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await Database.getAssets();
    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve assets', details: error.message });
  }
});

// 4. Admin Only: Create Digital Asset
app.post('/api/assets', authenticateAdmin, async (req, res) => {
  const { name, description, price, imageUrl, category, tags, purchaseLink, downloadUrl, downloadFileName } = req.body;

  if (!name || description === undefined || price === undefined || !imageUrl || !category) {
    return res.status(400).json({ error: 'Missing required digital asset fields (name, description, price, imageUrl, category)' });
  }

  try {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number or 0 (free)' });
    }

    const asset = await Database.addAsset({
      name: name.trim(),
      description: description.trim(),
      price: parsedPrice,
      purchaseLink: purchaseLink ? purchaseLink.trim() : '',
      downloadUrl: downloadUrl ? downloadUrl.trim() : '',
      downloadFileName: downloadFileName ? downloadFileName.trim() : '',
      imageUrl,
      category,
      tags: Array.isArray(tags) ? tags : []
    });

    res.status(201).json(asset);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create asset', details: error.message });
  }
});

// 5. Admin Only: Modify Digital Asset
app.put('/api/assets/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, category, tags, purchaseLink, downloadUrl, downloadFileName } = req.body;

  try {
    const updatedFields: any = {};
    if (name !== undefined) updatedFields.name = name.trim();
    if (description !== undefined) updatedFields.description = description.trim();
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Price must be a valid positive number or 0' });
      }
      updatedFields.price = parsedPrice;
    }
    if (purchaseLink !== undefined) updatedFields.purchaseLink = purchaseLink ? purchaseLink.trim() : '';
    if (downloadUrl !== undefined) updatedFields.downloadUrl = downloadUrl ? downloadUrl.trim() : '';
    if (downloadFileName !== undefined) updatedFields.downloadFileName = downloadFileName ? downloadFileName.trim() : '';
    if (imageUrl !== undefined) updatedFields.imageUrl = imageUrl;
    if (category !== undefined) updatedFields.category = category;
    if (tags !== undefined) updatedFields.tags = Array.isArray(tags) ? tags : [];

    const updatedAsset = await Database.updateAsset(id, updatedFields);
    res.json(updatedAsset);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to update asset ${id}`, details: error.message });
  }
});

// 6. Admin Only: Expunge Digital Asset
app.delete('/api/assets/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await Database.deleteAsset(id);
    if (deleted) {
      res.json({ success: true, message: `Successfully deleted asset ${id}` });
    } else {
      res.status(404).json({ error: `Asset with id ${id} not found` });
    }
  } catch (error: any) {
    res.status(500).json({ error: `Failed to delete asset ${id}`, details: error.message });
  }
});

// 7. Public/Guest: Increment Click KPI tracker
app.post('/api/assets/:id/click', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedAsset = await Database.recordClick(id);
    res.json({ success: true, id: updatedAsset.id, clicks: updatedAsset.clicks || 0 });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to record click metric`, details: error.message });
  }
});

// 8. Public/Guest: Increment Download KPI tracker for free assets
app.post('/api/assets/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedAsset = await Database.recordDownload(id);
    res.json({ success: true, id: updatedAsset.id, downloads: updatedAsset.downloads || 0 });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to record download metric`, details: error.message });
  }
});

// 9. Public/Guest: Toggle asset favorite
app.post('/api/assets/:id/favorite', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'increment' | 'decrement'
  try {
    const updatedAsset = await Database.toggleFavorite(id, action || 'increment');
    res.json({ success: true, id: updatedAsset.id, favorites: updatedAsset.favorites || 0 });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to toggle favorite metric`, details: error.message });
  }
});

// ======================== FULL-STACK CLIENT PLATFORM MODULE ========================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Mount Vite middleware in development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('â Vite developer asset integration server loaded');
  } else {
    // Serve build outputs in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Marketplace server running on http://localhost:${PORT}`);
  });
}

startServer();
