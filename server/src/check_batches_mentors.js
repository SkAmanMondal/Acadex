import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from './config/db.js';
import Batch from './modules/academics/batch.model.js';
import User from './modules/users/user.model.js';
import Department from './modules/academics/department.model.js';

async function checkBatches() {
  await connectDB();
  const batches = await Batch.find().populate('mentor department');
  console.log(`Total Batches: ${batches.length}`);
  batches.forEach(b => {
    console.log(`- Batch: ${b.name} (${b.department?.name}) -> Mentor: ${b.mentor ? b.mentor.name : 'NONE'}`);
  });
  process.exit(0);
}

checkBatches().catch(err => {
  console.error(err);
  process.exit(1);
});
