/**
 * Pharmacology Test Creator and Runner
 * A simple tool to create and run drug-group matching tests
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const groupsContainer = document.getElementById('groups-container');
  const addGroupBtn = document.getElementById('add-group');
  const generatePreviewBtn = document.getElementById('generate-preview');
  const exportJsonBtn = document.getElementById('export-json');
  const previewContainer = document.getElementById('preview-container');
  const questionsPreview = document.getElementById('questions-preview');
  const fileUpload = document.getElementById('file-upload');
  const fileInput = document.getElementById('file-input');
  const startTestBtn = document.getElementById('start-test');
  const testInfo = document.getElementById('test-info');
  const testType = document.getElementById('test-type');
  const testQuestionCount = document.getElementById('test-question-count');
  const testGroupCount = document.getElementById('test-group-count');
  const testContainer = document.getElementById('test-container');
  const testStart = document.getElementById('test-start');
  const questionContainer = document.getElementById('question-container');
  const currentQuestionEl = document.getElementById('current-question');
  const totalQuestionsEl = document.getElementById('total-questions');
  const prevQuestionBtn = document.getElementById('prev-question');
  const nextQuestionBtn = document.getElementById('next-question');
  const finishTestBtn = document.getElementById('finish-test');
  const resultContainer = document.getElementById('result-container');
  const scoreCorrect = document.getElementById('score-correct');
  const scoreTotal = document.getElementById('score-total');
  const scorePercent = document.getElementById('score-percent');
  const resultMessage = document.getElementById('result-message');
  const restartTestBtn = document.getElementById('restart-test');
  const timerEl = document.getElementById('timer');

  // State Variables
  let testData = null;
  let generatedQuestions = [];
  let currentQuestion = 0;
  let userAnswers = [];
  let timerInterval = null;
  let testTime = 0;
  let groupCounter = 0;

  // Initialize the app
  init();

  function init() {
    // Set up tab navigation
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${tabId}-tab`) {
            content.classList.add('active');
          }
        });
      });
    });

    // Add initial group
    addGroup();

    // Set up event listeners
    addGroupBtn.addEventListener('click', addGroup);
    generatePreviewBtn.addEventListener('click', generatePreview);
    exportJsonBtn.addEventListener('click', exportJson);
    fileUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    startTestBtn.addEventListener('click', startTest);
    prevQuestionBtn.addEventListener('click', goToPrevQuestion);
    nextQuestionBtn.addEventListener('click', goToNextQuestion);
    finishTestBtn.addEventListener('click', finishTest);
    restartTestBtn.addEventListener('click', restartTest);
  }

  /**
   * Creates a new drug group in the form
   * @param {string} groupName - Optional name for the group
   * @param {string[]} drugs - Optional array of drugs to add to the group
   */
  function addGroup(groupName = '', drugs = ['']) {
    groupCounter++;
    
    // Create group container
    const groupDiv = document.createElement('div');
    groupDiv.className = 'group-container';
    groupDiv.dataset.groupId = groupCounter;
    
    // Group header with name input and remove button
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    
    const groupLabel = document.createElement('label');
    groupLabel.textContent = `Група ${groupCounter}`;
    
    const groupNameInput = document.createElement('input');
    groupNameInput.type = 'text';
    groupNameInput.className = 'group-name';
    groupNameInput.placeholder = 'Име на групата';
    groupNameInput.value = groupName;
    groupNameInput.required = true;
    
    const removeGroupBtn = document.createElement('button');
    removeGroupBtn.type = 'button';
    removeGroupBtn.className = 'btn btn-secondary btn-icon';
    removeGroupBtn.textContent = '✕';
    removeGroupBtn.addEventListener('click', () => {
      if (document.querySelectorAll('.group-container').length > 1) {
        groupDiv.remove();
      } else {
        alert('Трябва да има поне една група');
      }
    });
    
    groupHeader.appendChild(groupLabel);
    groupHeader.appendChild(groupNameInput);
    groupHeader.appendChild(removeGroupBtn);
    
    // Drugs container
    const drugsContainer = document.createElement('div');
    drugsContainer.className = 'drugs-container';
    
    // Add initial drug inputs
    drugs.forEach(drug => {
      addDrugInput(drugsContainer, drug);
    });
    
    // Add new drug button
    const addDrugBtn = document.createElement('button');
    addDrugBtn.type = 'button';
    addDrugBtn.className = 'btn';
    addDrugBtn.textContent = '+ Добави лекарство';
    addDrugBtn.addEventListener('click', () => {
      addDrugInput(drugsContainer);
    });
    
    // Assemble group
    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(drugsContainer);
    groupDiv.appendChild(addDrugBtn);
    
    // Add to form
    groupsContainer.appendChild(groupDiv);
  }
  
  /**
   * Adds a drug input field to a drugs container
   * @param {HTMLElement} container - The container to add the drug input to
   * @param {string} value - Optional initial value for the drug input
   */
  function addDrugInput(container, value = '') {
    const drugInputContainer = document.createElement('div');
    drugInputContainer.className = 'drug-input-container';
    
    const drugInput = document.createElement('input');
    drugInput.type = 'text';
    drugInput.className = 'drug-name';
    drugInput.placeholder = 'Име на лекарство';
    drugInput.value = value;
    drugInput.required = true;
    
    const drugActions = document.createElement('div');
    drugActions.className = 'drug-actions';
    
    const addDrugBtn = document.createElement('button');
    addDrugBtn.type = 'button';
    addDrugBtn.className = 'btn btn-secondary btn-icon';
    addDrugBtn.textContent = '+';
    addDrugBtn.addEventListener('click', () => {
      addDrugInput(container, '');
      drugInputContainer.after(container.lastChild);
    });
    
    const removeDrugBtn = document.createElement('button');
    removeDrugBtn.type = 'button';
    removeDrugBtn.className = 'btn btn-secondary btn-icon';
    removeDrugBtn.textContent = '−';
    removeDrugBtn.addEventListener('click', () => {
      if (container.querySelectorAll('.drug-input-container').length > 1) {
        drugInputContainer.remove();
      } else {
        alert('Трябва да има поне едно лекарство в групата');
      }
    });
    
    drugActions.appendChild(addDrugBtn);
    drugActions.appendChild(removeDrugBtn);
    
    drugInputContainer.appendChild(drugInput);
    drugInputContainer.appendChild(drugActions);
    
    container.appendChild(drugInputContainer);
  }

  /**
   * Validates and collects data from the form
   * @returns {Object|null} - The collected test data or null if validation fails
   */
  function collectFormData() {
    // Get values from the form
    const questionType = document.getElementById('question-type').value;
    const questionCount = parseInt(document.getElementById('question-count').value);
    
    if (isNaN(questionCount) || questionCount < 1) {
      alert('Моля въведете валиден брой въпроси');
      return null;
    }
    
    // Collect groups and drugs
    const groups = [];
    const groupElements = document.querySelectorAll('.group-container');
    
    for (const groupEl of groupElements) {
      const groupName = groupEl.querySelector('.group-name').value.trim();
      
      if (!groupName) {
        alert('Всички групи трябва да имат име');
        return null;
      }
      
      const drugs = [];
      const drugInputs = groupEl.querySelectorAll('.drug-name');
      
      for (const drugInput of drugInputs) {
        const drugName = drugInput.value.trim();
        
        if (!drugName) {
          alert('Всички лекарства трябва да имат име');
          return null;
        }
        
        drugs.push(drugName);
      }
      
      groups.push({
        groupName,
        drugs
      });
    }
    
    if (groups.length < 2) {
      alert('Трябва да има поне две групи');
      return null;
    }
    
    return {
      questionType,
      questionCount,
      groups
    };
  }

  /**
   * Generates test questions based on the form data
   * @returns {Array|null} - Array of generated questions or null if generation fails
   */
  function generateQuestions() {
    const data = collectFormData();
    if (!data) return null;
    
    const questions = [];
    const { questionType, questionCount, groups } = data;
    
    // Function to create a drug-to-group question
    function createDrugToGroupQuestion() {
      // Select random group
      const randomGroupIndex = Math.floor(Math.random() * groups.length);
      const selectedGroup = groups[randomGroupIndex];
      
      if (selectedGroup.drugs.length === 0) {
        return null; // Skip if no drugs in the group
      }
      
      // Select random drug from the selected group
      const randomDrugIndex = Math.floor(Math.random() * selectedGroup.drugs.length);
      const selectedDrug = selectedGroup.drugs[randomDrugIndex];
      
      // Create wrong options (from other groups)
      const wrongOptions = groups
        .filter((_, index) => index !== randomGroupIndex) // Exclude the correct group
        .map(group => group.groupName);
      
      // Shuffle wrong options and take up to 9
      const shuffledWrongOptions = shuffleArray(wrongOptions).slice(0, 9);
      
      // Combine correct and wrong options
      const allOptions = shuffleArray([selectedGroup.groupName, ...shuffledWrongOptions]);
      
      return {
        type: 'drugToGroup',
        question: `Към коя група принадлежи ${selectedDrug}?`,
        options: allOptions,
        correctAnswer: selectedGroup.groupName
      };
    }
    
    // Function to create a group-to-drug question
    function createGroupToDrugQuestion() {
      // Select random group
      const randomGroupIndex = Math.floor(Math.random() * groups.length);
      const selectedGroup = groups[randomGroupIndex];
      
      if (selectedGroup.drugs.length === 0) {
        return null; // Skip if no drugs in the group
      }
      
      // Select random drug from the selected group as the correct answer
      const randomDrugIndex = Math.floor(Math.random() * selectedGroup.drugs.length);
      const selectedDrug = selectedGroup.drugs[randomDrugIndex];
      
      // Create wrong options (drugs from other groups)
      const wrongOptions = [];
      groups.forEach((group, index) => {
        if (index !== randomGroupIndex) {
          group.drugs.forEach(drug => {
            wrongOptions.push(drug);
          });
        }
      });
      
      // Shuffle wrong options and take up to 9
      const shuffledWrongOptions = shuffleArray(wrongOptions).slice(0, 9);
      
      // Combine correct and wrong options
      const allOptions = shuffleArray([selectedDrug, ...shuffledWrongOptions]);
      
      return {
        type: 'groupToDrug',
        question: `Кое от следните лекарства принадлежи към групата ${selectedGroup.groupName}?`,
        options: allOptions,
        correctAnswer: selectedDrug
      };
    }
    
    // Generate questions based on the question type
    let questionsGenerated = 0;
    let maxAttempts = questionCount * 5; // Prevent infinite loops
    
    while (questionsGenerated < questionCount && maxAttempts > 0) {
      let question = null;
      
      if (questionType === 'drugToGroup') {
        question = createDrugToGroupQuestion();
      } else if (questionType === 'groupToDrug') {
        question = createGroupToDrugQuestion();
      } else if (questionType === 'both') {
        // Randomly choose question type
        question = Math.random() < 0.5 ? createDrugToGroupQuestion() : createGroupToDrugQuestion();
      }
      
      if (question) {
        // Check for duplicate questions
        const isDuplicate = questions.some(q => 
          q.question === question.question && 
          arraysEqual(q.options, question.options)
        );
        
        if (!isDuplicate) {
          questions.push(question);
          questionsGenerated++;
        }
      }
      
      maxAttempts--;
    }
    
    return questions;
  }

  /**
   * Generates a preview of test questions
   */
  function generatePreview() {
    const questions = generateQuestions();
    if (!questions) return;
    
    generatedQuestions = questions;
    testData = collectFormData();
    
    // Show preview container
    previewContainer.classList.remove('hidden');
    
    // Clear previous preview
    questionsPreview.innerHTML = '';
    
    // Display questions
    questions.forEach((question, index) => {
      const questionEl = document.createElement('div');
      questionEl.className = 'preview-question';
      
      const questionText = document.createElement('div');
      questionText.className = 'question-text';
      questionText.textContent = `${index + 1}. ${question.question}`;
      
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'question-options';
      
      question.options.forEach(option => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        if (option === question.correctAnswer) {
          optionEl.classList.add('correct');
        }
        optionEl.textContent = option;
        optionsContainer.appendChild(optionEl);
      });
      
      questionEl.appendChild(questionText);
      questionEl.appendChild(optionsContainer);
      
      questionsPreview.appendChild(questionEl);
    });
    
    // Scroll to preview
    previewContainer.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Exports the form data as a JSON file
   */
  function exportJson() {
    const data = collectFormData();
    if (!data) return;
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pharmacology-test.json';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  /**
   * Handles file upload for test data
   * @param {Event} event - The file input change event
   */
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validate the imported data
        if (!data.questionType || !data.questionCount || !Array.isArray(data.groups)) {
          throw new Error('Невалиден формат на файла');
        }
        
        testData = data;
        
        // Update test info
        testType.textContent = getQuestionTypeText(data.questionType);
        testQuestionCount.textContent = data.questionCount;
        testGroupCount.textContent = data.groups.length;
        
        // Show test info and enable start button
        testInfo.classList.remove('hidden');
        startTestBtn.disabled = false;
      } catch (error) {
        alert('Грешка при зареждане на файла: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }

  /**
   * Gets the display text for a question type
   * @param {string} type - The question type identifier
   * @returns {string} - The display text
   */
  function getQuestionTypeText(type) {
    switch (type) {
      case 'drugToGroup':
        return 'Лекарство → Група';
      case 'groupToDrug':
        return 'Група → Лекарство';
      case 'both':
        return 'И двата типа';
      default:
        return type;
    }
  }

  /**
   * Starts the test
   */
  function startTest() {
    if (!testData) return;
    
    // Generate questions
    generatedQuestions = generateQuestions();
    if (!generatedQuestions || generatedQuestions.length === 0) {
      alert('Не могат да се генерират въпроси с текущите данни');
      return;
    }
    
    // Initialize test state
    currentQuestion = 0;
    userAnswers = Array(generatedQuestions.length).fill(null);
    
    // Update UI
    testStart.classList.add('hidden');
    testContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    // Update question counter
    totalQuestionsEl.textContent = generatedQuestions.length;
    
    // Start timer
    startTimer();
    
    // Display first question
    displayCurrentQuestion();
  }

  /**
   * Displays the current question
   */
  function displayCurrentQuestion() {
    // Update question navigation
    prevQuestionBtn.disabled = currentQuestion === 0;
    nextQuestionBtn.disabled = currentQuestion === generatedQuestions.length - 1;
    nextQuestionBtn.classList.toggle('hidden', currentQuestion === generatedQuestions.length - 1);
    finishTestBtn.classList.toggle('hidden', currentQuestion !== generatedQuestions.length - 1);
    
    // Update question counter
    currentQuestionEl.textContent = currentQuestion + 1;
    
    // Get current question
    const question = generatedQuestions[currentQuestion];
    
    // Clear question container
    questionContainer.innerHTML = '';
    
    // Create question element
    const questionEl = document.createElement('div');
    questionEl.className = 'question';
    
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = question.question;
    questionEl.appendChild(questionText);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'question-options';
    
    question.options.forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'option';
      optionEl.textContent = option;
      
      // Check if this option is selected
      if (userAnswers[currentQuestion] === option) {
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
        userAnswers[currentQuestion] = option;
      });
      
      optionsContainer.appendChild(optionEl);
    });
    
    questionEl.appendChild(optionsContainer);
    questionContainer.appendChild(questionEl);
  }

  /**
   * Go to the previous question
   */
  function goToPrevQuestion() {
    if (currentQuestion > 0) {
      currentQuestion--;
      displayCurrentQuestion();
    }
  }

  /**
   * Go to the next question
   */
  function goToNextQuestion() {
    if (currentQuestion < generatedQuestions.length - 1) {
      currentQuestion++;
      displayCurrentQuestion();
    }
  }

  /**
   * Finish the test and calculate results
   */
  function finishTest() {
    // Stop timer
    clearInterval(timerInterval);
    
    // Calculate score
    let correctAnswers = 0;
    
    generatedQuestions.forEach((question, index) => {
      if (userAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const totalQuestions = generatedQuestions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Update result elements
    scoreCorrect.textContent = correctAnswers;
    scoreTotal.textContent = totalQuestions;
    scorePercent.textContent = percentage;
    
    // Set result message
    if (percentage >= 90) {
      resultMessage.textContent = 'Отличен резултат!';
    } else if (percentage >= 70) {
      resultMessage.textContent = 'Много добър резултат!';
    } else if (percentage >= 50) {
      resultMessage.textContent = 'Добър резултат!';
    } else {
      resultMessage.textContent = 'Има още какво да научиш!';
    }
    
    // Show result container
    testContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
  }

  /**
   * Restart the test
   */
  function restartTest() {
    // Regenerate questions
    generatedQuestions = generateQuestions();
    
    // Reset state
    currentQuestion = 0;
    userAnswers = Array(generatedQuestions.length).fill(null);
    
    // Update UI
    resultContainer.classList.add('hidden');
    testContainer.classList.remove('hidden');
    
    // Start timer
    startTimer();
    
    // Display first question
    displayCurrentQuestion();
  }

  /**
   * Start the timer
   */
  function startTimer() {
    // Reset timer
    testTime = 0;
    updateTimerDisplay();
    
    // Clear existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // Start new timer
    timerInterval = setInterval(() => {
      testTime++;
      updateTimerDisplay();
    }, 1000);
  }

  /**
   * Update the timer display
   */
  function updateTimerDisplay() {
    const minutes = Math.floor(testTime / 60);
    const seconds = testTime % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Shuffles an array
   * @param {Array} array - The array to shuffle
   * @returns {Array} - The shuffled array
   */
  function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * Compares two arrays for equality
   * @param {Array} arr1 - First array
   * @param {Array} arr2 - Second array
   * @returns {boolean} - True if arrays are equal
   */
  function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }
});