import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  HelpCircle,
  Plus,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Eye,
  Users,
  ChevronRight,
  BookOpen,
  Building,
  User,
  GraduationCap,
  Search,
  Filter,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function QuizzesPage() {
  const { user, isTeacher, isHod, isAdmin, isStudent } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quiz Taking State (Student)
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [qIdx]: selectedOption }
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [quizSubmittedResult, setQuizSubmittedResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Review Mode State
  const [reviewQuiz, setReviewQuiz] = useState(null);

  // Submissions Viewer (Teacher)
  const [submissionsModal, setSubmissionsModal] = useState({ open: false, quiz: null, data: null });

  // Create Quiz Modal State (Teacher)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    subject: '',
    batch: '',
    durationMinutes: 15,
    maxAttempts: 1,
    questions: [
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        points: 5,
        explanation: '',
      },
    ],
  });

  // Edit Quiz State
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [editQuizData, setEditQuizData] = useState({
    title: '',
    description: '',
    subject: '',
    batch: '',
    durationMinutes: 15,
    maxAttempts: 1,
  });

  const handleOpenEdit = (quiz) => {
    setEditingQuiz(quiz);
    setEditQuizData({
      title: quiz.title || '',
      description: quiz.description || '',
      subject: quiz.subject?._id || quiz.subject || '',
      batch: quiz.batch?._id || quiz.batch || '',
      durationMinutes: quiz.durationMinutes || 15,
      maxAttempts: quiz.maxAttempts || 1,
    });
  };

  const handleUpdateQuiz = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/quizzes/${editingQuiz._id}`, editQuizData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Quiz updated successfully!' });
        setEditingQuiz(null);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update quiz' });
    }
  };

  const handleDeleteQuiz = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quiz and its recorded attempts?')) return;
    try {
      const res = await api.delete(`/quizzes/${id}`);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Quiz deleted successfully' });
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete quiz' });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [quizRes, depRes, subRes, batRes, teaRes] = await Promise.allSettled([
        api.get('/quizzes'),
        api.get('/academics/departments'),
        api.get('/academics/subjects'),
        api.get('/academics/batches'),
        api.get('/users/teachers'),
      ]);

      if (quizRes.status === 'fulfilled' && quizRes.value.data?.success) {
        setQuizzes(quizRes.value.data.data);
      }
      if (depRes.status === 'fulfilled' && depRes.value.data?.success) {
        setDepartments(depRes.value.data.data);
      }
      if (subRes.status === 'fulfilled' && subRes.value.data?.success) {
        setSubjects(subRes.value.data.data);
        if (subRes.value.data.data.length > 0) {
          setNewQuiz((prev) => ({ ...prev, subject: subRes.value.data.data[0]._id }));
        }
      }
      if (batRes.status === 'fulfilled' && batRes.value.data?.success) {
        setBatches(batRes.value.data.data);
        if (batRes.value.data.data.length > 0) {
          setNewQuiz((prev) => ({ ...prev, batch: batRes.value.data.data[0]._id }));
        }
      }
      if (teaRes.status === 'fulfilled' && teaRes.value.data?.success) {
        setTeachers(teaRes.value.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Multi-dimensional filtering logic
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      // Department
      if (selectedDepartment !== 'all') {
        const dId =
          q.department?._id ||
          q.department ||
          q.batch?.department?._id ||
          q.batch?.department ||
          q.subject?.department?._id ||
          q.subject?.department;
        if (dId?.toString() !== selectedDepartment) return false;
      }
      // Batch
      if (selectedBatch !== 'all') {
        const bId = q.batch?._id || q.batch;
        if (bId?.toString() !== selectedBatch) return false;
      }
      // Subject
      if (selectedSubject !== 'all') {
        const subId = q.subject?._id || q.subject;
        if (subId?.toString() !== selectedSubject) return false;
      }
      // Teacher
      if (selectedTeacher !== 'all') {
        const tId = q.createdBy?._id || q.createdBy;
        if (tId?.toString() !== selectedTeacher) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = q.title?.toLowerCase().includes(query);
        const matchSub = q.subject?.name?.toLowerCase().includes(query) || q.subject?.code?.toLowerCase().includes(query);
        const matchBatch = q.batch?.name?.toLowerCase().includes(query);
        if (!matchTitle && !matchSub && !matchBatch) return false;
      }
      return true;
    });
  }, [quizzes, selectedDepartment, selectedBatch, selectedSubject, selectedTeacher, searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  // Timer effect during active quiz
  useEffect(() => {
    let timer;
    if (activeQuiz && timeLeftSeconds > 0 && !quizSubmittedResult) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuiz, timeLeftSeconds, quizSubmittedResult]);

  // Start taking a quiz
  const handleStartQuiz = (quiz) => {
    setActiveQuiz(quiz);
    setSelectedAnswers({});
    setTimeLeftSeconds((quiz.durationMinutes || 15) * 60);
    setQuizSubmittedResult(null);
  };

  // Select an answer
  const handleSelectOption = (questionIndex, optionIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    try {
      setSubmittingQuiz(true);
      const answersArray = activeQuiz.questions.map((q, idx) => ({
        questionIndex: idx,
        selectedOption: selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : -1,
      }));

      const totalSpent = (activeQuiz.durationMinutes || 15) * 60 - timeLeftSeconds;

      const res = await api.post(`/quizzes/${activeQuiz._id}/submit`, {
        answers: answersArray,
        timeSpentSeconds: Math.max(10, totalSpent),
      });

      if (res.data?.success) {
        setQuizSubmittedResult(res.data.data);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit quiz' });
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleAutoSubmitQuiz = () => {
    handleSubmitQuiz();
  };

  // View attempts for a quiz (Teacher)
  const handleViewSubmissions = async (quiz) => {
    try {
      const res = await api.get(`/quizzes/${quiz._id}/attempts`);
      if (res.data?.success) {
        setSubmissionsModal({ open: true, quiz, data: res.data.data });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to fetch submissions' });
    }
  };

  // Question manipulation in Create Quiz
  const handleAddQuestion = () => {
    setNewQuiz((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          points: 5,
          explanation: '',
        },
      ],
    }));
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...newQuiz.questions];
    updated[index][field] = value;
    setNewQuiz({ ...newQuiz, questions: updated });
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...newQuiz.questions];
    updated[qIndex].options[optIndex] = value;
    setNewQuiz({ ...newQuiz, questions: updated });
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/quizzes', newQuiz);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Interactive quiz published successfully!' });
        setShowCreateModal(false);
        loadData();
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create quiz' });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-700 via-indigo-600 to-brand-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">
                Academic Assessments
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                Auto-Grading & Review
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Interactive Quizzes & Concept Assessments
            </h1>
            <p className="text-indigo-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Timed multiple-choice assessments, immediate objective scoring, concept explanations, and continuous academic engagement.
            </p>
          </div>

          {(isTeacher || isHod || isAdmin) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-indigo-700 text-xs font-bold shadow-lg hover:bg-indigo-50 transition cursor-pointer self-start md:self-auto"
            >
              <Plus size={16} />
              <span>Create New Quiz</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg.text && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg({ type: '', text: '' })} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Multi-Dimensional Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Building size={12} />
              <span>Department</span>
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <GraduationCap size={12} />
              <span>Batch Cohort</span>
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Batches</option>
              {batches
                .filter((b) => selectedDepartment === 'all' || (b.department?._id || b.department) === selectedDepartment)
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <BookOpen size={12} />
              <span>Subject</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <User size={12} />
              <span>Authored By Teacher</span>
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none"
            >
              <option value="all">All Faculty</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-900">{filteredQuizzes.length}</strong> quizzes
            </span>
            {(selectedDepartment !== 'all' || selectedBatch !== 'all' || selectedSubject !== 'all' || selectedTeacher !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedBatch('all');
                  setSelectedSubject('all');
                  setSelectedTeacher('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search quiz title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none w-64"
            />
          </div>
        </div>
      </div>

      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredQuizzes.map((quiz) => {
          const isAttempted = isStudent && quiz.hasAttempted;
          const myScore = quiz.myAttempt;

          return (
            <div
              key={quiz._id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {quiz.subject?.code || 'MCA'}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock size={13} />
                      <span>{quiz.durationMinutes} mins</span>
                    </div>
                    {(isAdmin || isHod || (isTeacher && (quiz.createdBy?._id === user?._id || quiz.createdBy === user?._id))) && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => handleOpenEdit(quiz)}
                          title="Edit Quiz"
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(quiz._id)}
                          title="Delete Quiz"
                          className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 line-clamp-1">{quiz.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {quiz.description || 'Comprehensive conceptual assessment.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    Questions: <strong className="text-slate-900">{quiz.questions?.length || 0}</strong>
                  </span>
                  <span>
                    Max Points: <strong className="text-slate-900">{quiz.totalPoints || 15}</strong>
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3">
                {isStudent ? (
                  isAttempted ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-emerald-600" />
                          <div>
                            <p className="text-[11px] font-bold text-emerald-900">Attempt Completed</p>
                            <p className="text-[10px] text-emerald-700">
                              Score: {myScore?.scoreObtained} / {myScore?.maxScore} ({myScore?.percentage}%)
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-800">
                          {myScore?.percentage >= 75 ? 'Excellent' : myScore?.percentage >= 50 ? 'Passed' : 'Needs Review'}
                        </span>
                      </div>
                      <button
                        onClick={() => setReviewQuiz(quiz)}
                        className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>Review Explanations</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-brand-600 text-white text-xs font-bold hover:shadow-md hover:shadow-indigo-500/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Start Assessment</span>
                    </button>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewSubmissions(quiz)}
                      className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Users size={14} />
                      <span>Submissions ({quiz.totalAttempts || 0})</span>
                    </button>
                    <button
                      onClick={() => setReviewQuiz(quiz)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                      title="Inspect Questions"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredQuizzes.length === 0 && !loading && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 space-y-3">
          <HelpCircle size={40} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No quizzes found matching the selected filters</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your Department, Batch, or Subject filter selection.
          </p>
        </div>
      )}

      {/* ==================== ACTIVE QUIZ MODAL (TIMED ASSESSMENT) ==================== */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
            {/* Modal Header with Live Timer */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  {activeQuiz.subject?.name} • CIA Assessment
                </span>
                <h2 className="text-lg font-extrabold">{activeQuiz.title}</h2>
              </div>

              {!quizSubmittedResult && (
                <div
                  className={`px-3.5 py-1.5 rounded-2xl font-mono text-sm font-bold flex items-center gap-2 border ${
                    timeLeftSeconds < 120
                      ? 'bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse'
                      : 'bg-white/10 border-white/20 text-indigo-200'
                  }`}
                >
                  <Clock size={16} />
                  <span>{formatTime(timeLeftSeconds)}</span>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {quizSubmittedResult ? (
                /* Celebration & Graded Results View */
                <div className="space-y-6">
                  <div className="p-6 rounded-3xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 text-center space-y-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                      <Award size={28} />
                    </div>
                    <h3 className="text-xl font-extrabold text-emerald-950">Assessment Evaluated!</h3>
                    <p className="text-xs text-emerald-700">
                      Your answers have been automatically verified and recorded in your academic profile.
                    </p>
                    <div className="flex items-center justify-center gap-6 pt-3">
                      <div>
                        <span className="text-xs text-slate-500">Score</span>
                        <p className="text-2xl font-extrabold text-emerald-800">
                          {quizSubmittedResult.scoreObtained} / {quizSubmittedResult.maxScore}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-emerald-200" />
                      <div>
                        <span className="text-xs text-slate-500">Percentage</span>
                        <p className="text-2xl font-extrabold text-emerald-800">
                          {quizSubmittedResult.percentage}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Question Review */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Answer Breakdown</h4>
                    {quizSubmittedResult.questions?.map((q, idx) => {
                      const graded = quizSubmittedResult.gradedAnswers?.find((g) => g.questionIndex === idx);
                      const isCorrect = graded?.isCorrect;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border ${
                            isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className="text-xs font-bold text-slate-900">
                              Q{idx + 1}. {q.questionText}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isCorrect ? `+${graded?.pointsAwarded} pts` : '0 pts'}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs mt-3">
                            {q.options?.map((opt, optIdx) => {
                              const isSelected = graded?.selectedOption === optIdx;
                              const isAnswerKey = q.correctOptionIndex === optIdx;

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl flex items-center justify-between border ${
                                    isAnswerKey
                                      ? 'bg-emerald-100/70 border-emerald-300 font-semibold text-emerald-950'
                                      : isSelected
                                      ? 'bg-rose-100/70 border-rose-300 font-semibold text-rose-950'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isAnswerKey && (
                                    <span className="text-[10px] uppercase font-bold text-emerald-700">Correct Answer</span>
                                  )}
                                  {isSelected && !isAnswerKey && (
                                    <span className="text-[10px] uppercase font-bold text-rose-700">Your Choice</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="mt-2 text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-200">
                              <strong>Concept Explanation:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Interactive Quiz Question Cards */
                <div className="space-y-6">
                  {activeQuiz.questions?.map((q, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-extrabold text-indigo-700">Question {idx + 1}</span>
                        <span className="text-[10px] font-bold text-slate-400">{q.points || 5} points</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 leading-snug">{q.questionText}</p>

                      {/* Options Radio List */}
                      <div className="space-y-2 pt-2">
                        {q.options?.map((opt, optIdx) => {
                          const isSelected = selectedAnswers[idx] === optIdx;

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(idx, optIdx)}
                              className={`w-full text-left p-3 rounded-2xl border text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt}</span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {quizSubmittedResult ? (
                <button
                  onClick={() => {
                    setActiveQuiz(null);
                    setQuizSubmittedResult(null);
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer ml-auto"
                >
                  Close & Return to Assessments
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to abandon this assessment?')) {
                        setActiveQuiz(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submittingQuiz}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingQuiz ? 'Submitting & Grading...' : 'Finish & Submit Assessment'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== REVIEW QUESTIONS MODAL ==================== */}
      {reviewQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {reviewQuiz.subject?.name}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">{reviewQuiz.title}</h3>
              </div>
              <button
                onClick={() => setReviewQuiz(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {reviewQuiz.questions?.map((q, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <p className="text-xs font-bold text-slate-900">
                    Q{idx + 1}. {q.questionText}
                  </p>
                  <div className="space-y-1 text-xs">
                    {q.options?.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`p-2 rounded-xl border ${
                          q.correctOptionIndex === optIdx
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {opt} {q.correctOptionIndex === optIdx && '✓ (Correct)'}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="text-[11px] text-slate-500 pt-1">
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUBMISSIONS MODAL (TEACHER) ==================== */}
      {submissionsModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Student Assessment Performance
                </span>
                <h3 className="text-base font-extrabold text-slate-900">{submissionsModal.quiz?.title}</h3>
              </div>
              <button
                onClick={() => setSubmissionsModal({ open: false, quiz: null, data: null })}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-600">Total Attempts</span>
                <p className="text-xl font-extrabold text-indigo-950">{submissionsModal.data?.totalStudents || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-600">Average Score</span>
                <p className="text-xl font-extrabold text-emerald-950">{submissionsModal.data?.avgScore || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                <span className="text-[10px] uppercase font-bold text-purple-600">Avg Percentage</span>
                <p className="text-xl font-extrabold text-purple-950">{submissionsModal.data?.avgPercentage || 0}%</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-2">Student</th>
                    <th className="pb-2">Score</th>
                    <th className="pb-2">Percentage</th>
                    <th className="pb-2">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissionsModal.data?.attempts?.map((att) => (
                    <tr key={att._id} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-800">{att.student?.name}</td>
                      <td className="py-2.5 font-semibold text-slate-700">
                        {att.scoreObtained} / {att.maxScore}
                      </td>
                      <td className="py-2.5 font-bold text-emerald-600">{att.percentage}%</td>
                      <td className="py-2.5 text-slate-500">
                        {new Date(att.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!submissionsModal.data?.attempts || submissionsModal.data?.attempts?.length === 0) && (
                <p className="text-center text-slate-400 py-6 text-xs">No student attempts recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE QUIZ MODAL (TEACHER) ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Author Interactive Quiz</h3>
                <p className="text-xs text-slate-500">Create multiple-choice questions with automatic grading.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quiz Title *</label>
                  <input
                    type="text"
                    required
                    value={newQuiz.title}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                    placeholder="e.g. Relational Calculus & Indexing"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={newQuiz.subject}
                    onChange={(e) => setNewQuiz({ ...newQuiz, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch *</label>
                  <select
                    value={newQuiz.batch}
                    onChange={(e) => setNewQuiz({ ...newQuiz, batch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={newQuiz.durationMinutes}
                    onChange={(e) => setNewQuiz({ ...newQuiz, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newQuiz.maxAttempts}
                    onChange={(e) => setNewQuiz({ ...newQuiz, maxAttempts: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Questions ({newQuiz.questions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Question</span>
                  </button>
                </div>

                {newQuiz.questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-700">Question #{qIdx + 1}</span>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">Points:</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={q.points}
                          onChange={(e) => handleQuestionChange(qIdx, 'points', Number(e.target.value))}
                          className="w-14 px-2 py-1 text-xs border border-slate-200 rounded-lg text-center"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Enter question prompt..."
                      value={q.questionText}
                      onChange={(e) => handleQuestionChange(qIdx, 'questionText', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    />

                    {/* Options */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Options (select the radio button for the correct answer):
                      </label>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIdx}`}
                            checked={q.correctOptionIndex === optIdx}
                            onChange={() => handleQuestionChange(qIdx, 'correctOptionIndex', optIdx)}
                            className="text-indigo-600 cursor-pointer"
                          />
                          <input
                            type="text"
                            required
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Concept explanation / solution rationale (optional)..."
                      value={q.explanation}
                      onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-600"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-700 transition cursor-pointer"
                >
                  Publish Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Edit Quiz Settings</h3>
              <button
                onClick={() => setEditingQuiz(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quiz Title *</label>
                <input
                  type="text"
                  required
                  value={editQuizData.title}
                  onChange={(e) => setEditQuizData({ ...editQuizData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={editQuizData.subject}
                    onChange={(e) => setEditQuizData({ ...editQuizData, subject: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch *</label>
                  <select
                    value={editQuizData.batch}
                    onChange={(e) => setEditQuizData({ ...editQuizData, batch: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={editQuizData.durationMinutes}
                    onChange={(e) => setEditQuizData({ ...editQuizData, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editQuizData.maxAttempts}
                    onChange={(e) => setEditQuizData({ ...editQuizData, maxAttempts: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  value={editQuizData.description}
                  onChange={(e) => setEditQuizData({ ...editQuizData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingQuiz(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Update Quiz Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
