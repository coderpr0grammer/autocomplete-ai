
// options.js
let knowledgeBase = {};

function addKnowledgeBaseField(key = '', value = '') {
    const div = document.createElement('div');
    div.innerHTML = `
        <input type="text" class="kb-key" value="${key}" placeholder="Field name (e.g., name, email, phone)">
        <input type="text" class="kb-value" value="${value}" placeholder="Value">
        <button class="remove-field">Remove</button>
    `;
    div.querySelector('.remove-field').addEventListener('click', () => div.remove());
    document.getElementById('knowledgeBase').appendChild(div);
}

document.getElementById('addField').addEventListener('click', () => addKnowledgeBaseField());

document.getElementById('save').addEventListener('click', () => {
    const generalInfo = document.getElementById('generalInfo').value;
    
    knowledgeBase = {};
    document.querySelectorAll('#knowledgeBase > div').forEach(div => {
        const key = div.querySelector('.kb-key').value;
        const value = div.querySelector('.kb-value').value;
        if (key && value) knowledgeBase[key] = value;
    });

    chrome.storage.sync.set({ generalInfo, knowledgeBase }, () => {
        alert('Settings saved');
    });
});

chrome.storage.sync.get(['generalInfo', 'knowledgeBase'], (result) => {
    document.getElementById('generalInfo').value = result.generalInfo || '';
    knowledgeBase = result.knowledgeBase || {};
    for (const [key, value] of Object.entries(knowledgeBase)) {
        addKnowledgeBaseField(key, value);
    }
});