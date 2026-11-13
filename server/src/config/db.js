import mongoose from 'mongoose';
import dns from 'dns';

// Force IPv4 resolution first and provide resilient DNS nameservers for MongoDB Atlas SRV lookups
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus360', {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(`[MongoDB Connected]: ${conn.connection.host} (Optimized High-Throughput Pool)`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB Runtime Connection Error]:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB Disconnected]: Attempting automatic reconnection...');
    });
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    process.exit(1);
  }
};
