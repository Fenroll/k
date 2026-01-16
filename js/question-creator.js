/**
 * Question Creator and Test Runner
 * Allows creating custom tests with multiple choice questions
 * Copies scoring and display logic from pharmacology test
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const testTitleInput = document.getElementById('testTitle');
  const questionNumInput = document.getElementById('testQuestionCount');
  const questionsContainer = document.getElementById('questionsContainer');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const startQCTestBtn = document.getElementById('startQCTestBtn');
  const exportQCBtn = document.getElementById('exportQCBtn');
  const clearQCFormBtn = document.getElementById('clearQCFormBtn');
  const importQCFile = document.getElementById('importQCFile');
  
  // Test runner elements
  const questionCreatorTestRunner = document.getElementById('questionCreatorTestRunner');
  const qcQuestionContainer = document.getElementById('qcQuestionContainer');
  const qcTestTitle = document.getElementById('qcTestTitle');
  const qcCurrentQuestion = document.getElementById('qcCurrentQuestion');
  const qcTotalQuestions = document.getElementById('qcTotalQuestions');
  const qcPrevQuestionBtn = document.getElementById('qcPrevQuestionBtn');
  const qcNextQuestionBtn = document.getElementById('qcNextQuestionBtn');
  const qcSubmitTestBtn = document.getElementById('qcSubmitTestBtn');
  
  // Results elements
  const questionCreatorResultsSection = document.getElementById('questionCreatorResultsSection');
  const qcScorePercentage = document.getElementById('qcScorePercentage');
  const qcCorrectAnswers = document.getElementById('qcCorrectAnswers');
  const qcTotalAnswers = document.getElementById('qcTotalAnswers');
  const qcDetailedResults = document.getElementById('qcDetailedResults');
  const qcRestartTestBtn = document.getElementById('qcRestartTestBtn');
  const qcNewTestBtn = document.getElementById('qcNewTestBtn');
  
  // State Variables
  let questions = [];
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let questionCounter = 0;
  let selectedTestQuestionCount = 5;
  let testQuestions = [];
  
  // Initialize
  init();
  
  function init() {
    addQuestionBtn.addEventListener('click', addQuestion);
    startQCTestBtn.addEventListener('click', startTest);
    exportQCBtn.addEventListener('click', exportJSON);
    clearQCFormBtn.addEventListener('click', clearForm);
    importQCFile.addEventListener('change', importJSON);
    qcPrevQuestionBtn.addEventListener('click', previousQuestion);
    qcNextQuestionBtn.addEventListener('click', nextQuestion);
    qcSubmitTestBtn.addEventListener('click', submitTest);
    qcRestartTestBtn.addEventListener('click', restartTest);
    qcNewTestBtn.addEventListener('click', newTest);
    
    // Add first question
    addQuestion();
  }
  
  /**
   * Add a new question
   */
  function addQuestion(questionText = '', answers = ['', '', '', ''], correctIndex = 0) {
    questionCounter++;
    questions.push({
      id: questionCounter,
      text: questionText,
      answers: answers,
      correctIndex: correctIndex
    });
    
    renderQuestions();
  }
  
  /**
   * Remove a question
   */
  function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    questionCounter--;
    renderQuestions();
  }
  
  /**
   * Update question text
   */
  function updateQuestionText(id, text) {
    const question = questions.find(q => q.id === id);
    if (question) {
      question.text = text;
    }
  }
  
  /**
   * Update an answer in a question
   */
  function updateAnswer(questionId, answerIndex, text) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      if (answerIndex >= question.answers.length) {
        question.answers.push(text);
      } else {
        question.answers[answerIndex] = text;
      }
    }
  }
  
  /**
   * Remove an answer from a question
   */
  function removeAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question && question.answers.length > 2) { // Keep at least 2 answers
      question.answers.splice(answerIndex, 1);
      // Adjust correctIndex if needed
      if (question.correctIndex >= question.answers.length) {
        question.correctIndex = question.answers.length - 1;
      }
      renderQuestions();
    }
  }
  
  /**
   * Set the correct answer for a question
   */
  function setCorrectAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      question.correctIndex = answerIndex;
      renderQuestions();
    }
  }
  
  /**
   * Render all questions in the form
   */
  function renderQuestions() {
    questionsContainer.innerHTML = '';
    
    questions.forEach((question, index) => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      
      // Question header
      const header = document.createElement('div');
      header.className = 'question-item-header';
      
      const numberLabel = document.createElement('div');
      numberLabel.className = 'question-item-number';
      numberLabel.textContent = `Вопрос ${index + 1}`;
      
      const actions = document.createElement('div');
      actions.className = 'question-item-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = 'Избриши';
      deleteBtn.addEventListener('click', () => removeQuestion(question.id));
      
      actions.appendChild(deleteBtn);
      header.appendChild(numberLabel);
      header.appendChild(actions);
      questionDiv.appendChild(header);
      
      // Question text
      const questionGroup = document.createElement('div');
      questionGroup.className = 'form-group';
      
      const questionLabel = document.createElement('label');
      questionLabel.textContent = 'Вопрос:';
      
      const questionInput = document.createElement('textarea');
      questionInput.className = 'form-control';
      questionInput.style.minHeight = '80px';
      questionInput.value = question.text;
      questionInput.addEventListener('change', (e) => updateQuestionText(question.id, e.target.value));
      
      questionGroup.appendChild(questionLabel);
      questionGroup.appendChild(questionInput);
      questionDiv.appendChild(questionGroup);
      
      // Answers section
      const answersContainer = document.createElement('div');
      answersContainer.className = 'answers-container';
      
      const answersLabel = document.createElement('label');
      answersLabel.textContent = 'Одговори:';
      answersContainer.appendChild(answersLabel);
      
      question.answers.forEach((answer, answerIndex) => {
        const answerRow = document.createElement('div');
        answerRow.className = 'answer-item-row';
        
        // Checkbox for correct answer
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.display = 'flex';
        checkboxDiv.style.alignItems = 'center';
        checkboxDiv.style.gap = '4px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'radio';
        checkbox.name = `correct-${question.id}`;
        checkbox.checked = question.correctIndex === answerIndex;
        checkbox.addEventListener('change', () => setCorrectAnswer(question.id, answerIndex));
        checkboxDiv.appendChild(checkbox);
        
        const correctLabel = document.createElement('label');
        correctLabel.textContent = '✓';
        correctLabel.title = 'Правилан одговор';
        correctLabel.style.fontSize = '12px';
        correctLabel.style.cursor = 'pointer';
        checkboxDiv.appendChild(correctLabel);
        
        // Answer input
        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.className = 'answer-input';
        answerInput.placeholder = `Одговор ${answerIndex + 1}`;
        answerInput.value = answer;
        answerInput.addEventListener('change', (e) => updateAnswer(question.id, answerIndex, e.target.value));
        
        // Delete button for answer
        const deleteAnswerBtn = document.createElement('button');
        deleteAnswerBtn.type = 'button';
        deleteAnswerBtn.className = 'btn btn-danger btn-small';
        deleteAnswerBtn.textContent = '✕';
        deleteAnswerBtn.title = 'Избриши одговор';
        deleteAnswerBtn.addEventListener('click', () => removeAnswer(question.id, answerIndex));
        deleteAnswerBtn.style.padding = '6px 8px';
        
        answerRow.appendChild(checkboxDiv);
        answerRow.appendChild(answerInput);
        if (question.answers.length > 2) {
          answerRow.appendChild(deleteAnswerBtn);
        }
        
        answersContainer.appendChild(answerRow);
      });
      
      // Add answer button
      const addAnswerBtn = document.createElement('button');
      addAnswerBtn.type = 'button';
      addAnswerBtn.className = 'btn btn-secondary btn-small';
      addAnswerBtn.textContent = '+ Додај одговор';
      addAnswerBtn.style.marginTop = '8px';
      addAnswerBtn.addEventListener('click', () => {
        question.answers.push('');
        renderQuestions();
      });
      answersContainer.appendChild(addAnswerBtn);
      
      questionDiv.appendChild(answersContainer);
      questionsContainer.appendChild(questionDiv);
    });
  }
  
  /**
   * Validate form
   */
  function validateForm() {
    if (!testTitleInput.value.trim()) {
      alert('Укажи наслов на тестот');
      return false;
    }
    
    if (questions.length === 0) {
      alert('Креирај барем еден вопрос');
      return false;
    }
    
    for (let q of questions) {
      if (!q.text.trim()) {
        alert('Сите вопроси мораат да имаат текст');
        return false;
      }
      
      if (q.answers.length < 2) {
        alert('Секој вопрос мора да има барем 2 одговора');
        return false;
      }
      
      for (let answer of q.answers) {
        if (!answer.trim()) {
          alert('Сите одговори мораат да имаат текст');
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Start the test
   */
  function startTest() {
    if (!validateForm()) return;
    
    // Get number of questions to include
    const numInput = prompt('Колку вопроси за тестот? (максимум ' + questions.length + ')', Math.min(5, questions.length));
    if (!numInput) return;
    
    selectedTestQuestionCount = Math.min(parseInt(numInput) || 5, questions.length);
    if (selectedTestQuestionCount < 1) selectedTestQuestionCount = 1;
    
    // Shuffle and select questions
    testQuestions = shuffleArray([...questions]).slice(0, selectedTestQuestionCount);
    
    // Initialize user answers
    userAnswers = new Array(testQuestions.length).fill(null);
    currentQuestionIndex = 0;
    
    // Update UI
    qcTestTitle.textContent = testTitleInput.value;
    qcTotalQuestions.textContent = testQuestions.length;
    
    // Hide creator, show test runner
    document.getElementById('questionCreatorSection').classList.add('hidden');
    questionCreatorTestRunner.classList.remove('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    // Display first question
    displayCurrentQuestion();
  }
  
  /**
   * Display the current question
   */
  function displayCurrentQuestion() {
    const question = testQuestions[currentQuestionIndex];
    
    // Update progress
    qcCurrentQuestion.textContent = currentQuestionIndex + 1;
    
    // Clear container
    qcQuestionContainer.innerHTML = '';
    
    // Create question element
    const questionEl = document.createElement('div');
    questionEl.className = 'question';
    
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = question.text;
    questionEl.appendChild(questionText);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'question-options';
    
    question.answers.forEach((answer, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'option';
      optionEl.textContent = answer;
      
      // Check if this option is selected
      if (userAnswers[currentQuestionIndex] === index) {
        optionEl.classList.add('selected');
      }
      
      optionEl.addEventListener('click', () => {
        // Remove selected class from all options
        optionsContainer.querySelectorAll('.option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        optionEl.classList.add('selected');
        
        // Save user answer
        userAnswers[currentQuestionIndex] = index;
      });
      
      optionsContainer.appendChild(optionEl);
    });
    
    questionEl.appendChild(optionsContainer);
    qcQuestionContainer.appendChild(questionEl);
    
    // Update button states
    qcPrevQuestionBtn.disabled = currentQuestionIndex === 0;
    qcNextQuestionBtn.disabled = currentQuestionIndex === testQuestions.length - 1;
    qcSubmitTestBtn.style.display = currentQuestionIndex === testQuestions.length - 1 ? 'inline-block' : 'none';
  }
  
  /**
   * Go to previous question
   */
  function previousQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      displayCurrentQuestion();
    }
  }
  
  /**
   * Go to next question
   */
  function nextQuestion() {
    if (currentQuestionIndex < testQuestions.length - 1) {
      currentQuestionIndex++;
      displayCurrentQuestion();
    }
  }
  
  /**
   * Submit the test and calculate results
   */
  function submitTest() {
    // Calculate score (copied from pharmacology test)
    let correctCount = 0;
    const results = [];
    
    testQuestions.forEach((question, index) => {
      const isCorrect = userAnswers[index] === question.correctIndex;
      if (isCorrect) {
        correctCount++;
      }
      
      results.push({
        question: question.text,
        userAnswer: userAnswers[index] !== null ? question.answers[userAnswers[index]] : 'Нема одговор',
        correctAnswer: question.answers[question.correctIndex],
        isCorrect: isCorrect
      });
    });
    
    const totalQuestions = testQuestions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    // Update result elements
    qcScorePercentage.textContent = percentage + '%';
    qcCorrectAnswers.textContent = correctCount;
    qcTotalAnswers.textContent = totalQuestions;
    
    // Display detailed results
    qcDetailedResults.innerHTML = '';
    results.forEach((result, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.style.marginBottom = '16px';
      resultDiv.style.padding = '12px';
      resultDiv.style.borderLeft = result.isCorrect ? '4px solid #22c55e' : '4px solid #ef4444';
      resultDiv.style.backgroundColor = result.isCorrect ? '#f0fdf4' : '#fef2f2';
      resultDiv.style.borderRadius = '4px';
      
      const questionH = document.createElement('strong');
      questionH.textContent = `Вопрос ${index + 1}: ${result.question}`;
      resultDiv.appendChild(questionH);
      
      const userAnswerP = document.createElement('p');
      userAnswerP.style.margin = '8px 0 0 0';
      userAnswerP.style.color = result.isCorrect ? '#16a34a' : '#dc2626';
      userAnswerP.innerHTML = `<strong>Твој одговор:</strong> ${result.userAnswer}`;
      resultDiv.appendChild(userAnswerP);
      
      if (!result.isCorrect) {
        const correctAnswerP = document.createElement('p');
        correctAnswerP.style.margin = '4px 0 0 0';
        correctAnswerP.style.color = '#16a34a';
        correctAnswerP.innerHTML = `<strong>Правилан одговор:</strong> ${result.correctAnswer}`;
        resultDiv.appendChild(correctAnswerP);
      }
      
      qcDetailedResults.appendChild(resultDiv);
    });
    
    // Hide runner, show results
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.remove('hidden');
  }
  
  /**
   * Restart the test
   */
  function restartTest() {
    currentQuestionIndex = 0;
    userAnswers = new Array(testQuestions.length).fill(null);
    
    // Show runner, hide results
    questionCreatorTestRunner.classList.remove('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    // Display first question
    displayCurrentQuestion();
  }
  
  /**
   * Create a new test
   */
  function newTest() {
    // Show creator, hide results
    document.getElementById('questionCreatorSection').classList.remove('hidden');
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.add('hidden');
  }
  
  /**
   * Export questions as JSON
   */
  function exportJSON() {
    if (!validateForm()) return;
    
    const data = {
      title: testTitleInput.value,
      questions: questions
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Import questions from JSON
   */
  function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.title || !data.questions) {
          alert('Неважечки JSON формат');
          return;
        }
        
        // Load data
        testTitleInput.value = data.title;
        questions = [];
        questionCounter = 0;
        
        data.questions.forEach(q => {
          questionCounter++;
          questions.push({
            id: questionCounter,
            text: q.text,
            answers: q.answers,
            correctIndex: q.correctIndex
          });
        });
        
        renderQuestions();
        alert('Вопросите се вчитаа успешно!');
      } catch (err) {
        alert('Грешка при вчитување на JSON: ' + err.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Clear the form
   */
  function clearForm() {
    if (confirm('Си сигурен? Сите вопроси ќе бидат избришани.')) {
      testTitleInput.value = '';
      questions = [];
      questionCounter = 0;
      renderQuestions();
      addQuestion();
    }
  }
  
  /**
   * Shuffle array utility
   */
  function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
});
