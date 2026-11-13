import Quiz from './quiz.model.js';
import QuizAttempt from './quizAttempt.model.js';
import StudentProfile from '../users/studentProfile.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { broadcastEvent } from '../../config/socket.js';

// ==================== CREATE QUIZ (TEACHER / HOD / ADMIN) ====================
export const createQuiz = async (req, res) => {
  try {
    const { title, description, subject, batch, durationMinutes, maxAttempts, questions, deadline } = req.body;

    if (!title || !subject || !batch || !questions || questions.length === 0) {
      return sendError(res, 'Please provide title, subject, batch, and at least one question', 400);
    }

    // Validate questions structure
    for (const q of questions) {
      if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2) {
        return sendError(res, 'Each question must have text and at least 2 options', 400);
      }
      if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
        return sendError(res, 'Invalid correct option index for a question', 400);
      }
    }

    const quiz = await Quiz.create({
      title,
      description: description || '',
      subject,
      batch,
      createdBy: req.user._id,
      durationMinutes: durationMinutes || 15,
      maxAttempts: maxAttempts || 1,
      questions,
      deadline: deadline || null,
      isPublished: true,
    });

    const populated = await Quiz.findById(quiz._id)
      .populate('subject batch createdBy', 'name code email');

    broadcastEvent('quiz_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Quiz created and published successfully', populated, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== UPDATE QUIZ (TEACHER / HOD / ADMIN) ====================
export const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, subject, batch, durationMinutes, maxAttempts, questions, deadline, isPublished } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) return sendError(res, 'Quiz not found', 404);

    if (req.user.role === 'teacher' && quiz.createdBy.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to edit this quiz', 403);
    }

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (subject) quiz.subject = subject;
    if (batch) quiz.batch = batch;
    if (durationMinutes !== undefined) quiz.durationMinutes = Number(durationMinutes);
    if (maxAttempts !== undefined) quiz.maxAttempts = Number(maxAttempts);
    if (deadline !== undefined) quiz.deadline = deadline;
    if (isPublished !== undefined) quiz.isPublished = isPublished;

    if (questions && Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2) {
          return sendError(res, 'Each question must have text and at least 2 options', 400);
        }
        if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
          return sendError(res, 'Invalid correct option index for a question', 400);
        }
      }
      quiz.questions = questions;
    }

    await quiz.save();
    const populated = await Quiz.findById(quiz._id).populate('subject batch createdBy', 'name code email');

    broadcastEvent('quiz_updated', populated);
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Quiz updated successfully', populated);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== DELETE QUIZ (TEACHER / HOD / ADMIN) ====================
export const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) return sendError(res, 'Quiz not found', 404);

    if (req.user.role === 'teacher' && quiz.createdBy.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized to delete this quiz', 403);
    }

    await Quiz.findByIdAndDelete(id);
    await QuizAttempt.deleteMany({ quiz: id });

    broadcastEvent('quiz_updated', { id, deleted: true });
    broadcastEvent('dashboard_refresh', {});

    return sendSuccess(res, 'Quiz and student attempts deleted');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== GET ALL QUIZZES ====================
export const getQuizzes = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'student') {
      const studentProfile = await StudentProfile.findOne({ user: req.user._id });
      if (studentProfile?.batch) {
        filter.batch = studentProfile.batch;
      }
      filter.isPublished = true;
    } else if (req.user.role === 'teacher') {
      filter.$or = [{ createdBy: req.user._id }];
    }

    const quizzes = await Quiz.find(filter)
      .populate('subject batch createdBy', 'name code email')
      .sort({ createdAt: -1 });

    // For students, check their attempts and sanitize answers if not attempted
    if (req.user.role === 'student') {
      const attempts = await QuizAttempt.find({ student: req.user._id });
      const attemptMap = {};
      attempts.forEach((a) => {
        attemptMap[a.quiz.toString()] = a;
      });

      const sanitizedQuizzes = quizzes.map((q) => {
        const obj = q.toObject();
        const myAttempt = attemptMap[q._id.toString()];
        obj.myAttempt = myAttempt || null;
        obj.hasAttempted = !!myAttempt;

        // If not attempted, hide answer keys
        if (!myAttempt) {
          obj.questions = obj.questions.map((question) => ({
            _id: question._id,
            questionText: question.questionText,
            options: question.options,
            points: question.points,
          }));
        }
        return obj;
      });

      return sendSuccess(res, 'Quizzes retrieved', sanitizedQuizzes);
    }

    // For teachers, append attempt stats
    const quizzesWithStats = await Promise.all(
      quizzes.map(async (q) => {
        const obj = q.toObject();
        const totalAttempts = await QuizAttempt.countDocuments({ quiz: q._id });
        obj.totalAttempts = totalAttempts;
        return obj;
      })
    );

    return sendSuccess(res, 'Quizzes retrieved', quizzesWithStats);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== GET SINGLE QUIZ BY ID ====================
export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('subject batch createdBy', 'name code email');

    if (!quiz) return sendError(res, 'Quiz not found', 404);

    if (req.user.role === 'student') {
      const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
      const obj = quiz.toObject();
      obj.myAttempt = attempt || null;
      obj.hasAttempted = !!attempt;

      if (!attempt) {
        // Strip out the answer keys
        obj.questions = obj.questions.map((q) => ({
          _id: q._id,
          questionText: q.questionText,
          options: q.options,
          points: q.points,
        }));
      }
      return sendSuccess(res, 'Quiz details', obj);
    }

    return sendSuccess(res, 'Quiz details', quiz);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== SUBMIT QUIZ ATTEMPT (STUDENT) ====================
export const submitQuiz = async (req, res) => {
  try {
    const { id: quizId } = req.params;
    const { answers, timeSpentSeconds } = req.body; // array of { questionIndex, selectedOption }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return sendError(res, 'Quiz not found', 404);

    // Check attempts limit
    const previousAttempts = await QuizAttempt.countDocuments({ quiz: quizId, student: req.user._id });
    if (previousAttempts >= quiz.maxAttempts) {
      return sendError(res, `Maximum attempts limit (${quiz.maxAttempts}) reached for this quiz`, 403);
    }

    // Grade each question
    let scoreObtained = 0;
    const gradedAnswers = [];

    quiz.questions.forEach((q, idx) => {
      const studentAnswer = answers?.find((a) => a.questionIndex === idx);
      const selectedOption = studentAnswer !== undefined 
        ? (studentAnswer.selectedOption !== undefined ? studentAnswer.selectedOption : studentAnswer.selectedOptionIndex ?? -1)
        : -1;
      const isCorrect = selectedOption === q.correctOptionIndex;
      const pointsAwarded = isCorrect ? (q.points || 1) : 0;

      if (isCorrect) scoreObtained += pointsAwarded;

      gradedAnswers.push({
        questionIndex: idx,
        selectedOption,
        isCorrect,
        pointsAwarded,
      });
    });

    const maxScore = quiz.totalPoints || quiz.questions.length;
    const percentage = maxScore > 0 ? Math.round((scoreObtained / maxScore) * 100) : 0;

    const attempt = await QuizAttempt.create({
      quiz: quizId,
      student: req.user._id,
      answers: gradedAnswers,
      scoreObtained,
      maxScore,
      percentage,
      timeSpentSeconds: timeSpentSeconds || 0,
      startedAt: new Date(Date.now() - (timeSpentSeconds || 60) * 1000),
      submittedAt: new Date(),
    });

    broadcastEvent('quiz_updated', attempt);
    broadcastEvent('dashboard_refresh', {});

    // Return the graded attempt with explanations
    return sendSuccess(res, 'Quiz submitted and auto-graded successfully!', {
      attemptId: attempt._id,
      scoreObtained,
      maxScore,
      percentage,
      gradedAnswers,
      questions: quiz.questions, // now reveal full questions with correct answers
    }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// ==================== GET QUIZ ATTEMPTS (TEACHER / HOD / ADMIN) ====================
export const getQuizAttempts = async (req, res) => {
  try {
    const { id: quizId } = req.params;

    const attempts = await QuizAttempt.find({ quiz: quizId })
      .populate('student', 'name email')
      .sort({ scoreObtained: -1, submittedAt: 1 });

    const totalStudents = attempts.length;
    const avgScore = totalStudents > 0
      ? Math.round((attempts.reduce((sum, a) => sum + a.scoreObtained, 0) / totalStudents) * 10) / 10
      : 0;
    const avgPercentage = totalStudents > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalStudents)
      : 0;

    return sendSuccess(res, 'Quiz submissions retrieved', {
      totalStudents,
      avgScore,
      avgPercentage,
      attempts,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
