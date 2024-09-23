// content.js

// Add these helper functions at the top of your content.js file
function getVisibleText(element) {
    return element.innerText || element.textContent;
  }
  
  function removeStopWords(str) {
    const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it',
      'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with']);
    return str.toLowerCase().split(' ').filter(word => !stopWords.has(word)).join(' ');
  }
  
  function getPageContext() {
    const title = document.title;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => getVisibleText(h)).join(' ');
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    return removeStopWords(`${title} ${headings} ${metaDescription}`);
  }
  
  function getFieldName(element) {
    // Existing checks
    const directName = element.name || element.id || element.getAttribute('aria-label') || 
                       element.getAttribute('placeholder');
    if (directName) return directName;
  
    // Check for associated label
    const labelElement = element.closest('label') || document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) {
      return getVisibleText(labelElement).trim();
    }
  
    // Check preceding text
    let previousElement = element.previousElementSibling;
    while (previousElement) {
      if (previousElement.nodeType === Node.TEXT_NODE || 
          ['LABEL', 'SPAN', 'DIV', 'P'].includes(previousElement.tagName)) {
        const text = getVisibleText(previousElement).trim();
        if (text) return text;
      }
      previousElement = previousElement.previousElementSibling;
    }
  
    // Check parent elements
    let parent = element.parentElement;
    while (parent) {
      const parentText = getVisibleText(parent).trim();
      if (parentText && parent.children.length < 5) {  // Avoid too generic parents
        return parentText;
      }
      parent = parent.parentElement;
    }
  
    // If all else fails, use nearby context
    const nearbyText = getNearbyText(element);
    const pageContext = getPageContext();
    
    // Use AI to determine the most likely field name
    return determineFieldNameWithAI(nearbyText, pageContext);
  }
  
  function getNearbyText(element) {
    const range = 100;  // characters to consider on each side
    let text = '';
    let node = element;
    while (node && text.length < range) {
      if (node.nodeType === Node.TEXT_NODE) {
        text = node.textContent.trim() + ' ' + text;
      }
      node = node.previousSibling || node.parentNode;
    }
    
    node = element;
    let afterText = '';
    while (node && afterText.length < range) {
      if (node.nodeType === Node.TEXT_NODE) {
        afterText += ' ' + node.textContent.trim();
      }
      node = node.nextSibling || node.parentNode;
    }
    
    return removeStopWords((text + afterText).trim());
  }
  
  async function determineFieldNameWithAI(nearbyText, pageContext) {
    const prompt = `Given the following context about a web page and the text near a form field, determine the most likely purpose or name of the form field. Respond with only the field name, nothing else.
  
  Page context: ${pageContext}
  Nearby text: ${nearbyText}
  
  Field name:`;
  
    try {
      const suggestion = await getSuggestions(prompt);
      return suggestion.trim();
    } catch (error) {
      console.error('Error determining field name:', error);
      return 'unknown field';
    }
  }

let typingTimer;
const doneTypingInterval = 500; // ms
let currentSuggestion = '';
let userKnowledgeBase = {};
let generalInfo = '';

chrome.storage.sync.get(['knowledgeBase', 'generalInfo'], (result) => {
  userKnowledgeBase = result.knowledgeBase || {};
  generalInfo = result.generalInfo || '';
});

document.addEventListener('focus', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    console.log("target", e.target);
    autofillField(e.target);
  }
}, true);

document.addEventListener('input', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => doneTyping(e.target), doneTypingInterval);
  }
});


// Modify the keydown event listener to remove ghost text immediately
document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab' && currentSuggestion) {
      e.preventDefault();
      const activeElement = document.activeElement;
      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
        activeElement.value += currentSuggestion;
        currentSuggestion = '';
        removeExistingGhostText();
        activeElement.focus();
      }
    }
  });

// Modify your existing autofillField function to use the new getFieldName
async function autofillField(element) {
  const fieldName = await getFieldName(element);
  if (fieldName && userKnowledgeBase[fieldName]) {
    element.value = userKnowledgeBase[fieldName];
  } else {
    getSuggestions(`Based on this general information about me: "${generalInfo}", suggest a value for the field: ${fieldName}`)
      .then(suggestion => {
        if (suggestion) {
          showSuggestion(element, suggestion);
        }
      })
      .catch(error => console.error('Error getting suggestions:', error));
  }
}

function getFieldName(element) {
  return element.name || element.id || element.getAttribute('aria-label') || 
         element.getAttribute('placeholder') || 
         element.closest('label')?.textContent.trim();
}



// Modify the getSuggestions function to improve prompting
async function getSuggestions(text) {
    const response = await fetch(process.env.AI_COMPLETIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AI_COMPLETIONS_API_KEY
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an assistant that provides short, contextual completions for sentences. Respond with only the completion, not a full sentence. Respond with only the completion, not a string with quotation marks.' },
          { role: 'user', content: `Complete this sentence: "${text}"` }
        ],
        max_tokens: 50,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: ["\n", "."]
      })
    });
  
    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
  
  // Modify the doneTyping function to handle partial sentences
  function doneTyping(element) {
    const text = element.value;
    if (text.length > 0) {
      const lastSentence = text.split('.').pop().trim();
      getSuggestions(lastSentence)
        .then(suggestion => {
          if (suggestion) {
            showSuggestion(element, suggestion);
          }
        })
        .catch(error => console.error('Error getting suggestions:', error));
    }
  }

// Modify the showSuggestion function
function showSuggestion(element, suggestion) {
    if (suggestion.startsWith("Unable to autofill:")) {
      console.log(suggestion);
      return;
    }
  
    // Remove any existing ghost text
    removeExistingGhostText();
  
    currentSuggestion = suggestion;
    
    const ghostText = document.createElement('span');
    ghostText.textContent = suggestion;
    ghostText.style.color = '#888';
    ghostText.style.position = 'absolute';
    ghostText.style.pointerEvents = 'none';
    ghostText.style.whiteSpace = 'pre';
    ghostText.className = 'ghost-text';  // Add a class for easy selection
    
    const computedStyle = window.getComputedStyle(element);
    ghostText.style.font = computedStyle.font;
    ghostText.style.padding = computedStyle.padding;
    ghostText.style.border = computedStyle.border;
    
    const rect = element.getBoundingClientRect();
    const { width: currentTextWidth, height: currentTextHeight } = getTextDimensions(element.value, computedStyle.font);
    
    ghostText.style.left = `${rect.left + currentTextWidth + window.scrollX}px`;
    ghostText.style.top = `${rect.top + window.scrollY}px`;
    
    document.body.appendChild(ghostText);
    
    // Remove ghost text on any input change or blur
    element.addEventListener('input', removeExistingGhostText);
    element.addEventListener('blur', removeExistingGhostText);
  }
  
  function removeExistingGhostText() {
    const existingGhostText = document.querySelector('.ghost-text');
    if (existingGhostText) {
      existingGhostText.remove();
    }
  }
  
  function getTextDimensions(text, font) {
    const canvas = getTextDimensions.canvas || (getTextDimensions.canvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    context.font = font;
    return { width: context.measureText(text).width, height: context.measureText('M').width };
  }