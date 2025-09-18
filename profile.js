document.addEventListener('DOMContentLoaded', async () => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
        window.location.href = 'index.html';
        return;
    }

    setupLogout();
    await fetchAndDisplayUserData(jwt);
});

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('jwt');
        window.location.href = 'index.html';
    });
}

async function fetchAndDisplayUserData(jwt) {
    const query = `
    query {
        user {
            login
            transactions(where: {type: {_eq: "xp"}}) {
                amount
                createdAt
            }
            progresses(order_by: {grade: desc}) {
                grade
                createdAt
                object {
                    name
                    type
                }
                path
            }
        }
    }
`;


    try {
        console.log('JWT:', jwt); // Log JWT before request
        console.log('Query:', query); // Log query before request

        const response = await fetch('https://learn.01founders.co/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        console.log('Full response:', data); // Debug full response

        if (data.errors) {
            throw new Error(data.errors[0].message);
        }

        // Access user data correctly from the response
        const userData = data.data.user[0]; // Access first user in array
        
        if (!userData) {
            throw new Error('No user data found');
        }

        // Debug data
        console.log('User data:', userData);
        console.log('Transactions:', userData.transactions);
        console.log('Progresses:', userData.progresses);

        displayUserInfo(userData);
        
        // Only create charts if data exists
        if (userData.transactions && userData.transactions.length > 0) {
            createXPChart(userData.transactions);
        }
        
        if (userData.progresses && userData.progresses.length > 0) {
            createProjectChart(userData.progresses);
        }

        // Add this call in fetchAndDisplayUserData after data fetch:
        if (userData.progresses) {
            displayGrades(userData.progresses);
        }


    } catch (error) {
        console.error('Error fetching user data:', error);
        if (error.message.includes('JWT') || error.message.includes('unauthorized')) {
            localStorage.removeItem('jwt');
            window.location.href = 'index.html';
        }
    }
}


function displayGrades(progresses) {
    const gradesList = document.getElementById('grades-list');
    if (!progresses || !Array.isArray(progresses)) return;

    const gradesHTML = progresses
        .filter(p => p.grade !== null && p.object?.name)
        .map(p => `
            <div class="grade-item ${p.grade > 0 ? 'pass' : 'fail'}">
                <span class="project-name">${p.object.name}</span>
                <span class="grade">${p.grade}</span>
                <span class="date">${new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
        `)
        .join('');

    gradesList.innerHTML = gradesHTML || '<p>No grades available</p>';
}


// profile.js
function displayUserInfo(userData) {
    if (!userData || !userData.transactions) return;

    // Display username
    document.getElementById('username-display').textContent = userData.login || 'N/A';

    // Calculate total XP
    const totalXP = userData.transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    document.getElementById('xp-display').textContent = `${totalXP.toLocaleString()} XP`;

    // Display skills
    displaySkills(userData.progresses);
}

function displaySkills(progresses) {
    const skillsContainer = document.getElementById('skills-display');
    
    const skillCategories = {
        'JavaScript': {
            color: '#F7DF1E',
            patterns: ['js', 'javascript', 'piscine-js', 'front-end'], // Added more patterns
            value: 0
        },
        'Go': {
            color: '#00ADD8',
            patterns: ['go', 'golang'],
            value: 0
        },
        'HTML/CSS': {
            color: '#E34F26',
            patterns: ['html', 'css', 'web'],
            value: 0
        },
        'Programming': {
            color: '#6C757D',
            patterns: ['prog', 'algorithm', 'basic'],
            value: 0
        },
        'Back-end': {
            color: '#3C873A',
            patterns: ['back', 'api', 'server', 'database'],
            value: 0
        }
    };

    // Improved skill calculation
    if (progresses && progresses.length) {
        progresses.forEach(progress => {
            if (progress.path) {
                const path = progress.path.toLowerCase();
                for (const [category, data] of Object.entries(skillCategories)) {
                    if (data.patterns.some(pattern => path.includes(pattern))) {
                        // Only count if there's a grade
                        if (progress.grade > 0) {
                            data.value += progress.grade;
                        }
                    }
                }
            }
        });
    }

    // Enhanced display with better styling
    const skillsHTML = Object.entries(skillCategories)
        .map(([category, data]) => {
            const isActive = data.value > 0;
            return `
                <div class="skill-badge ${isActive ? 'active' : 'inactive'}" 
                     style="background-color: ${data.color}; opacity: ${isActive ? 1 : 0.7}">
                    <span class="category-name">${category}</span>
                    <span class="category-value">${data.value > 0 ? Math.round(data.value).toLocaleString() + ' XP' : 'Not started'}</span>
                </div>
            `;
        }).join('');

    skillsContainer.innerHTML = skillsHTML;
}

function createXPChart(transactions) {
    const sortedData = transactions
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!sortedData || !sortedData.length) return;
    
    const viewBox = "0 0 600 400";
    const margin = { top: 20, right: 20, bottom: 50, left: 70 }; // Increased margins for labels
    
    const xScale = (i) => margin.left + (i * ((600 - margin.left - margin.right) / (sortedData.length - 1)));
    const yScale = (val) => 400 - margin.bottom - ((val / Math.max(...sortedData.map(d => d.amount))) * (400 - margin.top - margin.bottom));

    const points = sortedData.map((d, i) => `${xScale(i)},${yScale(d.amount)}`).join(' ');
    
    const svg = `
        <svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
            <path 
                d="M ${points}"
                fill="none"
                stroke="#007bff"
                stroke-width="2"
            />
            ${createAxes(600, 400, margin, sortedData)}
            ${createDataPoints(sortedData, xScale, yScale)}
        </svg>
    `;

    document.getElementById('xpChart').innerHTML = svg;
}

function createProjectChart(progresses) {
    if (!progresses || !progresses.length) return;

    const passed = progresses.filter(p => p.grade > 0).length;
    const failed = progresses.filter(p => p.grade === 0).length;
    const total = passed + failed;
    
    const radius = 100;
    const centerX = 150;
    const centerY = 150;
    const viewBox = "0 0 300 300";
    
    const passedAngle = (passed / total) * 360;
    const failedAngle = 360 - passedAngle;
    const passedPercentage = Math.round((passed / total) * 100);
    const failedPercentage = Math.round((failed / total) * 100);

    const svg = `
        <svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">
            ${createPieSlice(centerX, centerY, radius, 0, passedAngle, '#28a745', passedPercentage)}
            ${createPieSlice(centerX, centerY, radius, passedAngle, 360, '#dc3545', failedPercentage)}
            ${createLegend()}
        </svg>
    `;

    document.getElementById('projectChart').innerHTML = svg;
}

function createAxes(width, height, margin, data) {
    const maxXP = Math.max(...data.map(d => d.amount));
    const yTicks = 5; // Number of ticks on Y axis
    
    // Create Y-axis ticks and labels
    const yAxisTicks = Array.from({length: yTicks}, (_, i) => {
        const value = Math.round((maxXP / (yTicks - 1)) * i);
        const y = height - margin.bottom - ((value / maxXP) * (height - margin.top - margin.bottom));
        return `
            <g>
                <line 
                    x1="${margin.left}" 
                    x2="${width - margin.right}" 
                    y1="${y}" 
                    y2="${y}" 
                    stroke="#eee"
                    stroke-dasharray="2,2"
                />
                <text 
                    x="${margin.left - 10}" 
                    y="${y}" 
                    text-anchor="end" 
                    alignment-baseline="middle"
                    class="axis-label"
                >
                    ${value.toLocaleString()} XP
                </text>
            </g>
        `;
    }).join('');

    // Create X-axis date labels
    const xAxisLabels = data.map((d, i) => {
        const x = margin.left + (i * ((width - margin.left - margin.right) / (data.length - 1)));
        const date = new Date(d.createdAt).toLocaleDateString();
        return `
            <g transform="translate(${x},${height - margin.bottom + 20})">
                <text 
                    transform="rotate(45)"
                    text-anchor="start"
                    class="axis-label"
                >
                    ${date}
                </text>
            </g>
        `;
    }).filter((_, i) => i % Math.ceil(data.length / 10) === 0).join('');

    return `
        <g class="axes">
            <line 
                x1="${margin.left}" 
                y1="${height - margin.bottom}" 
                x2="${width - margin.right}" 
                y2="${height - margin.bottom}" 
                stroke="black" 
            />
            <line 
                x1="${margin.left}" 
                y1="${height - margin.bottom}" 
                x2="${margin.left}" 
                y2="${margin.top}" 
                stroke="black" 
            />
            ${yAxisTicks}
            ${xAxisLabels}
        </g>
    `;
}

function createDataPoints(data, xScale, yScale) {
    return data.map((d, i) => `
        <g>
            <circle 
                cx="${xScale(i)}" 
                cy="${yScale(d.amount)}" 
                r="4" 
                fill="#007bff"
            />
        </g>
    `).join('');
}

function createPieSlice(cx, cy, r, startAngle, endAngle, color, percentage) {
    // Convert angles to radians
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    // Calculate points
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    // Determine which arc to use
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    
    // Calculate label position
    const midAngle = (startAngle + endAngle) / 2 - 90;
    const labelRadius = r * 0.7;
    const labelX = cx + labelRadius * Math.cos(midAngle * Math.PI / 180);
    const labelY = cy + labelRadius * Math.sin(midAngle * Math.PI / 180);

    return `
        <g>
            <path d="
                M ${cx} ${cy}
                L ${x1} ${y1}
                A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
                Z"
                fill="${color}"
            />
            <text
                x="${labelX}"
                y="${labelY}"
                text-anchor="middle"
                alignment-baseline="middle"
                fill="white"
                font-weight="bold"
            >
                ${percentage}%
            </text>
        </g>
    `;
}

function polarToCartesian(cx, cy, r, angle) {
    const radian = (angle - 90) * Math.PI / 180;
    return {
        x: cx + r * Math.cos(radian),
        y: cy + r * Math.sin(radian)
    };
}

function createLegend() {
    return `
        <g transform="translate(220, 20)">
            <rect width="20" height="20" fill="#28a745" />
            <text x="25" y="15">Passed</text>
            <rect y="30" width="20" height="20" fill="#dc3545" />
            <text x="25" y="45">Failed</text>
        </g>
    `;
}
