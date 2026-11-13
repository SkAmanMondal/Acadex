import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    block: {
      type: String,
      trim: true,
      default: 'Main Block',
    },
    capacity: {
      type: Number,
      required: true,
      default: 60,
    },
    type: {
      type: String,
      enum: ['lecture_hall', 'computer_lab', 'seminar_hall', 'tutorial_room'],
      default: 'lecture_hall',
    },
    hasProjector: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Classroom = mongoose.model('Classroom', classroomSchema);
export default Classroom;
