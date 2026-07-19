/**
 * StadiumPulse 2026 - Stadium Operations & Fan Experience Command Hub
 * Built with raw ES6 JavaScript and dynamic GenAI interfaces.
 */

window.StadiumPulse = (() => {
  'use strict';

  // ==========================================
  // 0. UTILITIES & SAFETY
  // ==========================================
  const sanitizeAndFormat = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  };

  const renderSanitizedMarkdown = (container, text) => {
    container.replaceChildren();
    if (!text) return;
    const lines = text.split('\n');
    lines.forEach((lineText, idx) => {
      if (idx > 0) {
        container.appendChild(document.createElement('br'));
      }
      const regex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;
      const lineSpan = document.createElement('span');
      while ((match = regex.exec(lineText)) !== null) {
        if (match.index > lastIndex) {
          lineSpan.appendChild(document.createTextNode(lineText.substring(lastIndex, match.index)));
        }
        const strong = document.createElement('strong');
        strong.textContent = match[1];
        lineSpan.appendChild(strong);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < lineText.length) {
        lineSpan.appendChild(document.createTextNode(lineText.substring(lastIndex)));
      }
      container.appendChild(lineSpan);
    });
  };

  const showInfoModal = (title, content) => {
    UI.elements.infoModalTitle.textContent = title;
    UI.elements.infoModalBody.replaceChildren();
    if (typeof content === 'string') {
      renderSanitizedMarkdown(UI.elements.infoModalBody, content);
    } else if (content instanceof HTMLElement) {
      UI.elements.infoModalBody.appendChild(content);
    }
    UI.elements.infoModal.classList.remove('hidden');
  };

  const highlightSVGElement = (id) => {
    document.querySelectorAll('.map-stand, .map-gate').forEach(el => {
      el.classList.remove('highlighted');
    });

    const target = document.getElementById(id);
    if (target) {
      target.classList.add('highlighted');
      setTimeout(() => {
        target.classList.remove('highlighted');
      }, 5000);
    }
  };

  const highlightRoute = (gateL, standL) => {
    document.querySelectorAll('.map-stand, .map-gate').forEach(el => {
      el.classList.remove('highlighted');
    });

    if (gateL) {
      const gateEl = document.getElementById('map-gate-' + gateL);
      if (gateEl) gateEl.classList.add('highlighted');
    }
    if (standL) {
      const standEl = document.getElementById('map-stand-' + standL);
      if (standEl) standEl.classList.add('highlighted');
    }

    setTimeout(() => {
      if (gateL) {
        const gateEl = document.getElementById('map-gate-' + gateL);
        if (gateEl) gateEl.classList.remove('highlighted');
      }
      if (standL) {
        const standEl = document.getElementById('map-stand-' + standL);
        if (standEl) standEl.classList.remove('highlighted');
      }
    }, 6000);
  };

  // ==========================================
  // 1. STATE & DATA STORAGE
  // ==========================================
  const State = {
    activeView: 'fan',
    apiKey: localStorage.getItem('stadiumpulse_api_key') || '',
    ecoPoints: parseInt(localStorage.getItem('stadiumpulse_eco_points')) || 0,
    ecoCarbonSaved: parseFloat(localStorage.getItem('stadiumpulse_eco_carbon')) || 0.0,
    
    // Core Stadium Operations metrics
    stadiumState: {
      stands: {
        'Stand A': 'low',
        'Stand B': 'low',
        'Stand C': 'medium',
        'Stand D': 'low'
      },
      gates: {
        'Gate A': 10,
        'Gate B': 15,
        'Gate C': 12,
        'Gate D': 8,
        'Gate E': 5,
        'Gate F': 8
      }
    },
    
    // Incidents queue
    incidents: [
      {
        id: 1,
        location: 'Stand C (South stands)',
        category: 'Crowd Bottleneck',
        desc: 'Concession queue extending into the aisle, blocking exit pathways.',
        priority: 'Medium',
        dispatch: 'AI Triage: Crowd flow obstructed. Action: Re-route overflow queue to Stand D concession counter. Deploy volunteer squad to direct fans and maintain clear aisle.',
        resolved: false,
        coords: { x: 200, y: 290 }
      },
      {
        id: 2,
        location: 'Gate B',
        category: 'Facility Issue',
        desc: 'Digital scanner at Turnstile 4 is offline. Spectators queuing up.',
        priority: 'High',
        dispatch: 'AI Triage: Entrance rate reduced by 25%. Action: Re-allocate backup gate agent to perform manual barcode scans. Redirect incoming fans to Gate F via dynamic screens.',
        resolved: false,
        coords: { x: 370, y: 200 }
      }
    ],

    // Active simulation scenario
    activeScenario: 'normal',
    
    // Map of coordinates for incident dots on the SVG
    coordMap: {
      'Stand A (North stands)': { x: 200, y: 110 },
      'Stand B (East stands)': { x: 290, y: 200 },
      'Stand C (South stands)': { x: 200, y: 290 },
      'Stand D (West stands)': { x: 110, y: 200 },
      'Gate A': { x: 200, y: 30 },
      'Gate B': { x: 370, y: 200 },
      'Gate C': { x: 200, y: 370 },
      'Gate D': { x: 30, y: 200 },
      'Gate E': { x: 90, y: 90 },
      'Gate F': { x: 310, y: 310 },
      'Concourse Restrooms': { x: 150, y: 150 },
      'Concessions Corridor': { x: 250, y: 250 }
    }
  };

  // Preset Transit Times & Schedules
  const TransitSchedules = [
    { name: 'Metro Line A (Stadium Stn)', freq: 'Every 4 mins', status: 'On Time', eco: true, delayed: false },
    { name: 'Express Shuttle Bus 204', freq: 'Every 6 mins', status: 'Congestion on Route 6', eco: true, delayed: true },
    { name: 'Pedestrian Walkway North', freq: 'Open (Light crowd)', status: 'Clear', eco: true, delayed: false },
    { name: 'West Parking / Rideshare Hub', freq: 'Wait time: 20 mins', status: 'High Volume', eco: false, delayed: true }
  ];

  // ==========================================
  // 2. GENAI INTEGRATION SERVICE
  // ==========================================
  const GenAIService = {
    // Generate AI response
    async callAI(prompt, systemInstruction) {
      if (State.apiKey && State.apiKey.trim() !== '') {
        const isAI21 = State.apiKey.startsWith('AQ.');
        try {
          if (isAI21) {
            // Call AI21 Labs Jamba model
            const response = await fetch('https://api.ai21.com/studio/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${State.apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'jamba-instruct',
                messages: [
                  { role: 'system', content: systemInstruction },
                  { role: 'user', content: prompt }
                ],
                max_tokens: 250,
                temperature: 0.7
              })
            });

            if (!response.ok) {
              const err = await response.text();
              throw new Error(`AI21 API error: ${response.status} - ${err}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
              return {
                thought: "[Running Live GenAI model: AI21 jamba-instruct]",
                content: data.choices[0].message.content.trim()
              };
            } else {
              throw new Error("Invalid response format from AI21 API");
            }
          } else {
            // Call Google Gemini model
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${State.apiKey}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `${systemInstruction}\n\nUser Question/Request: ${prompt}`
                  }]
                }],
                generationConfig: {
                  maxOutputTokens: 250,
                  temperature: 0.7
                }
              })
            });

            if (!response.ok) {
              const err = await response.text();
              throw new Error(`Gemini API error: ${response.status} - ${err}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
              return {
                thought: "[Running Live GenAI model: gemini-1.5-flash]",
                content: data.candidates[0].content.parts[0].text.trim()
              };
            } else {
              throw new Error("Invalid response format from Gemini API");
            }
          }
        } catch (error) {
          console.error("Live API Request Failed. Falling back to local rules engine:", error);
          return this.fallbackRulesEngine(prompt, systemInstruction, `[API Fail: ${error.message} - Running Local Rules Backup]`);
        }
      } else {
        // Run fully interactive mock rules simulation
        return this.fallbackRulesEngine(prompt, systemInstruction, "[Local Mode: Zero-Setup Simulation Engine]");
      }
    },

    fallbackRulesEngine(prompt, systemInstruction, headerText) {
      const cleanPrompt = prompt.toLowerCase();
      let thought = `${headerText}\n• System Context: ${systemInstruction.split('.')[0]}\n• Checking patterns matching: "${prompt.substring(0, 30)}..."`;
      let content = "";

      // Smart rules matching according to context (Fan Concierge, Volunteer, Ops Command)
      if (systemInstruction.includes("Fan Concierge")) {
        thought += "\n• Routing to Fan Concierge domain logic...\n• Mapping stadium gates and amenities...";
        if (cleanPrompt.includes("gate") || cleanPrompt.includes("entrance")) {
          content = "For the best experience today: Gates A & D are operating with minimal lines (under 10 mins). Gate B (East) is experiencing higher traffic due to the shuttle terminal rush. If you are seated in Stands B or C, entering via Gate F (Accessibility/South-East) or Gate C (South) will save you about 15 minutes of queue time.";
        } else if (cleanPrompt.includes("food") || cleanPrompt.includes("eat") || cleanPrompt.includes("concession")) {
          content = "The main concessions are located on the Level 1 concourse. Currently, Stand C Concessions has long queues (approx 20 mins). We recommend visiting Concourse Hall 1 near Stand D, which is currently quiet and has a full selection of tournament snacks, beverages, and gluten-free options.";
        } else if (cleanPrompt.includes("toilet") || cleanPrompt.includes("restroom")) {
          content = "Restrooms are distributed across all stands. To avoid queues during the match breaks, avoid the main south concourse restrooms. The facilities behind Stand A (North) and Stand D (West) have shorter queue times and include ADA-accessible stalls.";
        } else if (cleanPrompt.includes("accessibility") || cleanPrompt.includes("wheelchair") || cleanPrompt.includes("disabled")) {
          content = "StadiumPulse prioritizes accessible routes! Gate F is our dedicated accessibility entry point with ramp access. All stands feature elevator shafts to upper levels. There are quiet sensory rooms located behind Sector 108 near Stand A if you or a family member needs a break from the crowd noise.";
        } else if (cleanPrompt.includes("german") || cleanPrompt.includes("deutsch")) {
          content = "Willkommen im Stadion! Der Anstoß erfolgt in Kürze. Sie finden Ihren Sitzplatz am besten über Gate A. Wenn Sie Fragen haben, stehe ich Ihnen gerne zur Verfügung!";
        } else if (cleanPrompt.includes("spanish") || cleanPrompt.includes("hola") || cleanPrompt.includes("espanol")) {
          content = "¡Bienvenido a la Copa Mundial de la FIFA 2026! Las puertas están abiertas. El acceso más rápido a la tribuna sur (Stand C) es por la Puerta C. ¿En qué más puedo ayudarte hoy?";
        } else if (cleanPrompt.includes("transit") || cleanPrompt.includes("shuttle") || cleanPrompt.includes("schedule") || cleanPrompt.includes("train") || cleanPrompt.includes("bus")) {
          content = "🚇 Metro Line A is currently ON TIME (every 4 mins) and is the fastest transit mode. Shuttle Bus 204 is experiencing 6 mins delays due to Route 6 traffic. Walkways are open. Check the Smart Transit widget for live times.";
        } else if (cleanPrompt.includes("match") || cleanPrompt.includes("game") || cleanPrompt.includes("team") || cleanPrompt.includes("vs") || cleanPrompt.includes("play")) {
          content = "Match 12 is scheduled for today: GER vs MEX. Kick-off is in 2 hours and 45 minutes. Stadium gates are open, and stands are filling up. Enjoy the game!";
        } else {
          content = "Hello! I am your Stadium Concierge. You can ask me how to find the quickest path to your seat, locate concessions/restrooms, check train transit schedules, or log your green actions. Let me know how I can make your World Cup day smoother!";
        }
      } else if (systemInstruction.includes("Incident Triage")) {
        thought += "\n• Parsing volunteer incident report...\n• Classifying impact severity & security priorities...";
        if (cleanPrompt.includes("spill") || cleanPrompt.includes("hazard")) {
          content = "Priority: Medium. Incident logged in dispatch. Recommendation: Deploy Maintenance Team C from South Hub immediately with warning signage. Station volunteer at Sector 104 to guide spectators around the spill until cleaned.";
        } else if (cleanPrompt.includes("bottleneck") || cleanPrompt.includes("crowd") || cleanPrompt.includes("jam")) {
          content = "Priority: High. Operational bottleneck identified. Triage directive: Deploy Crowd Control Unit 4 to gate channels to double-lane queues. Trigger dynamic signage update to divert incoming visitors to neighboring gates.";
        } else if (cleanPrompt.includes("medical") || cleanPrompt.includes("hurt") || cleanPrompt.includes("faint")) {
          content = "Priority: Critical. Emergency Response triggered. Triage instruction: Dispatch Stadium Medical Team 2 (Station West) to Stand B row 22. Assign Sector Volunteer to stand at access stairwell B-4 to guide medics directly to the patient.";
        } else {
          content = "Priority: Low. Informational report captured. Triage directive: Assign nearby floating volunteer to investigate details at location and report back. Maintain general stand surveillance.";
        }
      } else if (systemInstruction.includes("Co-Pilot")) {
        thought += "\n• Analyzing global sensor network and incident counts...\n• Computing load-balancing recommendations...";
        if (cleanPrompt.includes("scenario") || cleanPrompt.includes("exit") || State.activeScenario === 'exit') {
          content = "🚨 OPS ADVISORY: Post-Match Exit Flow Active.\n1. Dispatch shuttle buses from depot to load-balance Gate A and Gate C terminals.\n2. Enable 'Green Route' pedestrian announcements on public speakers to spread the crowd.\n3. Adjust digital signs inside stands to indicate Gate D is clear for exiting fans.";
        } else if (State.activeScenario === 'gate-failure') {
          content = "⚠️ SECURITY BULLETIN: Gate B Scanner Malfunction.\n1. Re-route 30% of Gate B flow to Gate F (Accessibility/South-East) using dynamic fencing.\n2. Deploy 4 volunteers with hand-held backup scanners from the central operations office.\n3. Send push alert to fans currently in transit advising Gate A or Gate D entry.";
        } else if (State.activeScenario === 'stand-concession') {
          content = "🍔 OPERATIONAL UPDATE: Concessions Congestion at Stand C.\n1. Broadcast concession voucher discounts via the mobile app for Stand A/D stands to balance demand.\n2. Open auxiliary drink kiosks in Sector 112.\n3. direct staff to implement queue stanchions to prevent concourse corridor blockages.";
        } else {
          content = "✅ SYSTEM STATUS: Normal. Stadium operations running smoothly. Wait times at all gates are under 15 minutes. Crowd distributions are balanced. Recommend maintaining current staff allocations.";
        }
      } else if (systemInstruction.includes("Transit")) {
        thought += "\n• Routing to Transit Planner domain logic...\n• Parsing selected transit mode & wait times...";
        if (cleanPrompt.includes("option: transit")) {
          content = "🚇 **Metro Line A Route Plan:** Board at Central Station. Arrival at Stadium Station (North gate) in 15 mins. Eco-Impact: **Highly Efficient (-2.4kg CO2 saved)**. Frequency: On Time (every 4 mins). Direct entrance via Gate A.";
        } else if (cleanPrompt.includes("option: shuttle")) {
          content = "🚌 **Express Stadium Shuttle Route Plan:** Board at Downtown Terminal. Travel time: 22 mins (subject to slight congestion on Route 6). Eco-Impact: **Efficient (-1.8kg CO2 saved)**. Entrance via East Gate B.";
        } else if (cleanPrompt.includes("option: walk")) {
          content = "🚶 **Pedestrian Walkway Plan:** Clear path along the North Concourse. Walk time: 8-10 mins. Eco-Impact: **Zero Carbon (-3.0kg CO2 saved)**. Enter directly via North Gate A (no queue).";
        } else if (cleanPrompt.includes("option: rideshare") || cleanPrompt.includes("option: taxi")) {
          content = "🚗 **Rideshare Plan:** Drop-off at West Rideshare Zone. Expected transit: 25 mins. Warning: High volume, wait times around 20 mins. Eco-Impact: **Low Efficiency (+1.2kg CO2)**. Direct access to Gate D.";
        } else {
          content = "Please select a valid transit route to calculate real-time AI guidance.";
        }
      } else if (systemInstruction.includes("Wayfinding")) {
        thought += "\n• Routing to Wayfinding Planner domain logic...\n• Computing path avoiding crowd bottlenecks...";
        let steps = [];
        
        if (cleanPrompt.includes("gate a")) {
          steps.push("1. Enter through Gate A (North Entrance) and pass security checks.");
        } else if (cleanPrompt.includes("gate b")) {
          steps.push("1. Enter through Gate B (East Entrance). Note: dynamic routing recommends using Gate F if queues exceed 15 mins.");
        } else if (cleanPrompt.includes("gate c")) {
          steps.push("1. Enter through Gate C (South Entrance) and proceed up the ramp.");
        } else if (cleanPrompt.includes("gate d")) {
          steps.push("1. Enter through Gate D (West Entrance). Pass turnstiles.");
        } else if (cleanPrompt.includes("gate e")) {
          steps.push("1. Enter through Gate E (VIP Entrance).");
        } else if (cleanPrompt.includes("gate f")) {
          steps.push("1. Enter through Gate F (Dedicated Accessibility gate).");
        } else {
          steps.push("1. Enter through your closest designated gate.");
        }

        let targetStand = "Stand A";
        let standLetter = "A";
        if (cleanPrompt.includes("stand a")) { targetStand = "Stand A (North stands)"; standLetter = "A"; }
        else if (cleanPrompt.includes("stand b")) { targetStand = "Stand B (East stands)"; standLetter = "B"; }
        else if (cleanPrompt.includes("stand c")) { targetStand = "Stand C (South stands)"; standLetter = "C"; }
        else if (cleanPrompt.includes("stand d")) { targetStand = "Stand D (West stands)"; standLetter = "D"; }

        // Adaptive rerouting warning for congested zones
        const targetStandKey = "Stand " + standLetter;
        const currentDensity = State.stadiumState.stands[targetStandKey] || 'low';
        if (currentDensity === 'critical' || currentDensity === 'high') {
          steps.push(`⚠️ Stand ${standLetter} is reporting ${currentDensity.toUpperCase()} density. Redirect active: Avoid the main concourse bottleneck. Proceed via the outer perimeter bypass corridors.`);
        }

        if (cleanPrompt.includes("restrooms")) {
          steps.push("2. Proceed to the main concourse level. Restrooms are located behind Sector 108 (Stand A) or Sector 120 (Stand D).");
          steps.push("3. Follow the blue overhead signage. Standard and accessible facilities are fully open.");
        } else if (cleanPrompt.includes("concessions")) {
          steps.push("2. Walk to the main Food & Concessions Hall 1.");
          steps.push("3. Recommendation: Concessions near Stand C are congested; we suggest using Stand A counters which are clear.");
        } else if (cleanPrompt.includes("first aid")) {
          steps.push("2. Follow the red cross floor markers along the south concourse wall.");
          steps.push("3. Check in at the medical counter located next to Gate C.");
        } else {
          if (cleanPrompt.includes("wheelchair") || cleanPrompt.includes("accessible")) {
            steps.push(`2. Use Elevator Shaft 4 (West Concourse) or Shaft 2 (North Concourse) to bypass stairs.`);
            steps.push(`3. Follow wheelchair path markings to the designated accessible seating zone in ${targetStand}.`);
          } else {
            steps.push(`2. Walk up the main concourse access stairs toward Sector 105.`);
            steps.push(`3. Locate row indicators and find your seat in ${targetStand}.`);
          }
        }
        
        content = steps.join("\n");
      } else if (systemInstruction.includes("Announcer")) {
        thought += "\n• Routing to PA Announcement Generator domain logic...\n• Translating and adjusting tone matching parameters...";
        
        let lowerPrompt = prompt.toLowerCase();
        let targetLang = "English";
        if (lowerPrompt.includes("spanish")) targetLang = "Spanish";
        else if (lowerPrompt.includes("french")) targetLang = "French";
        else if (lowerPrompt.includes("arabic")) targetLang = "Arabic";
        else if (lowerPrompt.includes("german")) targetLang = "German";
        else if (lowerPrompt.includes("portuguese")) targetLang = "Portuguese";
        
        let targetTone = "Informative";
        if (lowerPrompt.includes("urgent")) targetTone = "Urgent";
        else if (lowerPrompt.includes("calm")) targetTone = "Calm";

        let cleanTopic = lowerPrompt.split('about: "')[1] ? lowerPrompt.split('about: "')[1].split('"')[0] : "stadium guidelines";
        
        // Map of standard announcements in multiple languages
        const announcements = {
          English: {
            Urgent: `🚨 ATTENTION SPECTATORS: Please be advised of security or queue congestion at the entrance gates. We urgently request all fans to follow dynamic sign redirects. Thank you for your cooperation.`,
            Calm: `Attention spectators: To ensure a smooth flow, we kindly suggest checking alternative gates for entry. Thank you for choosing green transport.`,
            Informative: `Notice to fans: For faster entry, Gate A and Gate F are open with short wait times. Gates B and C are currently busy.`
          },
          Spanish: {
            Urgent: `🚨 ATENCIÓN ESPECTADORES: Les informamos de congestión en las puertas de entrada. Solicitamos urgentemente seguir las señales de re-direccionamiento. Gracias por su cooperación.`,
            Calm: `Atención espectadores: Para mayor fluidez, sugerimos amavelmente verificar portas alternativas de acesso. Gracias por su cooperación.`,
            Informative: `Aviso a los aficionados: Las Puertas A y F están abiertas y con tiempos de espera cortos para su comodidad.`
          },
          French: {
            Urgent: `🚨 ATTENTION SPECTATEURS: Files d'attente encombrées aux portes d'entrée. Veuillez vous rediriger vers les portes secondaires. Merci de votre coopération.`,
            Calm: `Attention spectateurs: Pour un flux plus fluide, nous suggérons d'utiliser d'autres portes d'accès. Merci de votre coopération.`,
            Informative: `Avis aux supporters: Les portes A et F sont ouvertes avec de faibles temps d'attente.`
          },
          Arabic: {
            Urgent: `🚨 انتباه للجمهور: يرجى العلم بوجود ازدحام عند بوابات الدخول. نرجو منكم اتباع إشارات تحويل المسار. شكراً لتعاونكم.`,
            Calm: `انتباه للجمهور: لضمان دخول سلس، نرجو التحقق من البوابات البديلة. شكراً لتعاونكم.`,
            Informative: `تنويه للمشجعين: البوابة A والبوابة F مفتوحتان حالياً مع أوقات انتظار قصيرة.`
          },
          German: {
            Urgent: `🚨 ACHTUNG ZUSCHAUER: Warteschlangen an den Toren sind überlastet. Wir bitten darum, die dynamischen Umlenkungen zu beachten. Danke.`,
            Calm: `Achtung Zuschauer: Für einen reibungslosen Ablauf empfehlen wir, alternative Tore zu nutzen. Danke.`,
            Informative: `Hinweis für Fans: Tor A und Tor F sind mit kurzen Wartezeiten geöffnet.`
          },
          Portuguese: {
            Urgent: `🚨 ATENÇÃO ESPECTADORES: Informamos de congestionamento nos portões de entrada. Solicitamos seguir os redirecionamentos. Obrigado.`,
            Calm: `Atenção espectadores: Para garantir um fluxo suave, sugerimos utilizar portões alternativos. Obrigado.`,
            Informative: `Aviso aos adeptos: O Portão A e o Portão F estão abertos com tempos de espera reduzidos.`
          }
        };

        let langObj = announcements[targetLang] || announcements.English;
        let announcementText = langObj[targetTone] || langObj.Informative;
        
        // If it's a custom topic, use a translated template
        if (cleanTopic.length > 2 && cleanTopic !== "stadium guidelines") {
          const capitalizedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
          if (targetLang === "Spanish") {
            announcementText = `📢 [Anuncio Oficial]: Atención con respecto a "${capitalizedTopic}". Por favor, mantenga la calma y siga las instrucciones del personal voluntario. Tono: ${targetTone}.`;
          } else if (targetLang === "French") {
            announcementText = `📢 [Annonce Officielle]: Concernant "${capitalizedTopic}". Veuillez rester calme et suivre les instructions du personnel. Ton: ${targetTone}.`;
          } else if (targetLang === "German") {
            announcementText = `📢 [Offizielle Ankündigung]: Betreffend "${capitalizedTopic}". Bitte bleiben Sie ruhig und befolgen Sie die Anweisungen des Personals. Ton: ${targetTone}.`;
          } else if (targetLang === "Arabic") {
            announcementText = `📢 [إعلان رسمي]: بخصوص "${capitalizedTopic}". يرجى الحفاظ على الهدوء واتباع تعليمات المنظمين. النبرة: ${targetTone}.`;
          } else if (targetLang === "Portuguese") {
            announcementText = `📢 [Anúncio Oficial]: Relativo a "${capitalizedTopic}". Por favor, mantenha a calma e siga as instruções dos voluntários. Tom: ${targetTone}.`;
          } else {
            announcementText = `📢 [Official Announcement]: Regarding "${capitalizedTopic}". Please remain calm and follow the directions of stadium stewards. Tone: ${targetTone}.`;
          }
        }
        
        content = announcementText;
      }

      return { thought, content };
    }
  };

  // ==========================================
  // 3. CORE UI CONTROLLER
  // ==========================================
  const UI = {
    elements: {},

    init() {
      // Cache DOM Elements
      this.elements = {
        timeEl: document.getElementById('current-time'),
        dateEl: document.getElementById('current-date'),
        globalAlert: document.getElementById('global-alert-bar'),
        
        // Views
        fanView: document.getElementById('fan-view'),
        staffView: document.getElementById('staff-view'),
        opsView: document.getElementById('ops-view'),
        
        // View buttons
        btnFan: document.getElementById('view-btn-fan'),
        btnStaff: document.getElementById('view-btn-staff'),
        btnOps: document.getElementById('view-btn-ops'),
        
        // Fan portal elements
        transitList: document.getElementById('fan-transit-list'),
        routeOutput: document.getElementById('route-output-box'),
        routeSelector: document.getElementById('route-selector'),
        carbonSavedText: document.getElementById('eco-carbon-saved'),
        greenPointsText: document.getElementById('eco-green-points'),
        badgesContainer: document.getElementById('eco-badges-container'),
        
        // Wayfinder
        wayfinderForm: document.getElementById('wayfinder-form'),
        wayfinderFrom: document.getElementById('wayfinder-from'),
        wayfinderTo: document.getElementById('wayfinder-to'),
        wayfinderAccessible: document.getElementById('wayfinder-accessible'),
        wayfinderResult: document.getElementById('wayfinding-result'),
        wayfinderRouteTitle: document.getElementById('wayfinding-route-title'),
        wayfinderSteps: document.getElementById('wayfinding-route-steps'),
        
        // Staff portal elements
        incidentList: document.getElementById('staff-incident-list'),
        incidentForm: document.getElementById('incident-form'),
        incidentLoc: document.getElementById('incident-location'),
        incidentCat: document.getElementById('incident-category'),
        incidentDesc: document.getElementById('incident-desc'),
        annTopic: document.getElementById('ann-topic'),
        annLang: document.getElementById('ann-lang'),
        annTone: document.getElementById('ann-tone'),
        annOutput: document.getElementById('announcement-output-box'),
        annText: document.getElementById('announcement-text'),
        
        // Ops portal elements
        svgMap: document.getElementById('stadium-svg-map'),
        incidentsLayer: document.getElementById('map-incidents-layer'),
        alertsBoard: document.getElementById('ops-alerts-board'),
        copilotAdvice: document.getElementById('ops-co-pilot-advice'),
        
        // Settings Modal
        settingsModal: document.getElementById('settings-modal'),
        settingsBtn: document.getElementById('settings-btn'),
        settingsClose: document.getElementById('settings-close-btn'),
        settingsKeyInput: document.getElementById('settings-api-key'),
        
        // Info Modal
        infoModal: document.getElementById('info-modal'),
        infoModalTitle: document.getElementById('info-modal-title'),
        infoModalBody: document.getElementById('info-modal-body'),
        infoModalClose: document.getElementById('info-modal-close-btn'),
        
        // Chatbot Panel
        chatToggle: document.getElementById('chat-toggle-btn'),
        chatWindow: document.getElementById('chat-window'),
        chatForm: document.getElementById('chat-form'),
        chatInput: document.getElementById('chat-input'),
        chatMessages: document.getElementById('chat-messages'),
        chatRoleTitle: document.getElementById('chat-role-title'),
        chatModeBadge: document.getElementById('chat-mode-badge')
      };

      this.initClock();
      this.initEvents();
      this.initA11yEvents();
      this.renderTransitSchedules();
      this.renderIncidents();
      this.renderEcoDashboard();
      this.updateMapAesthetics();
      this.resetChatGreeting();
      this.updateOpsPanel();
      this.initDragChat();
    },

    initClock() {
      const updateClock = () => {
        const now = new Date();
        this.elements.timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.elements.dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
      };
      updateClock();
      setInterval(updateClock, 1000);
    },

    initDragChat() {
      const chatWin = this.elements.chatWindow;
      const chatHeader = document.getElementById('chat-header-drag');
      if (!chatWin || !chatHeader) return;

      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

      chatHeader.onmousedown = dragMouseDown;

      function dragMouseDown(e) {
        e = e || window.event;
        if (e.button !== 0) return; // Left click only
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        const topPos = chatWin.offsetTop - pos2;
        const leftPos = chatWin.offsetLeft - pos1;

        const minLeft = 10;
        const maxLeft = window.innerWidth - chatWin.offsetWidth - 10;
        const minTop = 10;
        const maxTop = window.innerHeight - chatWin.offsetHeight - 10;

        chatWin.style.top = Math.max(minTop, Math.min(topPos, maxTop)) + "px";
        chatWin.style.left = Math.max(minLeft, Math.min(leftPos, maxLeft)) + "px";
        chatWin.style.bottom = 'auto';
        chatWin.style.right = 'auto';
      }

      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    },

    initEvents() {
      // Settings modal toggles
      this.elements.settingsBtn.addEventListener('click', () => {
        this.elements.settingsKeyInput.value = State.apiKey;
        this.elements.settingsModal.classList.remove('hidden');
        this.elements.settingsBtn.setAttribute('aria-expanded', 'true');
      });
      this.elements.settingsClose.addEventListener('click', () => {
        this.elements.settingsModal.classList.add('hidden');
        this.elements.settingsBtn.setAttribute('aria-expanded', 'false');
      });
      this.elements.infoModalClose.addEventListener('click', () => {
        this.elements.infoModal.classList.add('hidden');
      });
      window.addEventListener('click', (e) => {
        if (e.target === this.elements.settingsModal) {
          this.elements.settingsModal.classList.add('hidden');
        }
        if (e.target === this.elements.infoModal) {
          this.elements.infoModal.classList.add('hidden');
        }
      });

      // Switch view tabs
      this.elements.btnFan.addEventListener('click', () => switchView('fan'));
      this.elements.btnStaff.addEventListener('click', () => switchView('staff'));
      this.elements.btnOps.addEventListener('click', () => switchView('ops'));

      // Transit button
      const transitBtn = document.getElementById('transit-calculate-btn');
      if (transitBtn) {
        transitBtn.addEventListener('click', calculateTransitRoute);
      }

      // Eco checkboxes
      const ecoChecks = ['eco-check-transit', 'eco-check-recycle', 'eco-check-bottle'];
      ecoChecks.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateEcoScore);
      });

      // Wayfinding Form
      if (this.elements.wayfinderForm) {
        this.elements.wayfinderForm.addEventListener('submit', handleWayfinding);
      }

      // Incident Form
      if (this.elements.incidentForm) {
        this.elements.incidentForm.addEventListener('submit', handleLogIncident);
      }

      // Announcement button
      const annBtn = document.getElementById('announcement-generate-btn');
      if (annBtn) {
        annBtn.addEventListener('click', generateAnnouncement);
      }

      // Settings Save button
      const saveSettingsBtn = document.querySelector('#settings-modal .primary-btn');
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
      }

      // Simulator buttons
      const simButtons = {
        'sim-btn-normal': 'normal',
        'sim-btn-exit': 'exit',
        'sim-btn-gate-failure': 'gate-failure',
        'sim-btn-stand-concession': 'stand-concession'
      };
      Object.entries(simButtons).forEach(([id, scenario]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => triggerScenario(scenario));
      });

      // Chat toggles
      if (this.elements.chatToggle) {
        this.elements.chatToggle.addEventListener('click', toggleChat);
      }
      const chatClose = document.getElementById('chat-close-btn');
      if (chatClose) {
        chatClose.addEventListener('click', toggleChat);
      }
      const chatMin = document.getElementById('chat-minimize-btn');
      if (chatMin) {
        chatMin.addEventListener('click', toggleMinimizeChat);
      }
      if (this.elements.chatForm) {
        this.elements.chatForm.addEventListener('submit', handleChatSubmit);
      }

      // SVG Map Elements click listeners
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(letter => {
        const gate = document.getElementById('map-gate-' + letter);
        if (gate) {
          gate.addEventListener('click', () => showGateDetails('Gate ' + letter));
        }
      });
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const stand = document.getElementById('map-stand-' + letter);
        if (stand) {
          stand.addEventListener('click', () => showStandDetails('Stand ' + letter));
        }
      });
    },

    initA11yEvents() {
      // Add keyboard support to interactive SVG map elements
      document.querySelectorAll('.map-stand, .map-gate').forEach(el => {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
          }
        });
      });
    },

    // Renders the list of real-time transportation
    renderTransitSchedules() {
      this.elements.transitList.replaceChildren();
      TransitSchedules.forEach(item => {
        const div = document.createElement('div');
        div.className = `transit-item ${item.delayed ? 'delayed' : ''}`;
        
        const infoDiv = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.style.fontSize = '0.95rem';
        h4.style.fontWeight = '600';
        h4.textContent = item.name;
        
        const p = document.createElement('p');
        p.style.fontSize = '0.8rem';
        p.style.color = 'var(--text-muted)';
        p.textContent = `Status: ${item.status}`;
        
        infoDiv.appendChild(h4);
        infoDiv.appendChild(p);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'transit-time';
        timeDiv.textContent = item.freq;

        div.appendChild(infoDiv);
        div.appendChild(timeDiv);
        this.elements.transitList.appendChild(div);
      });
    },

    // Draw active incidents queue
    renderIncidents() {
      this.elements.incidentList.replaceChildren();
      
      const unresolved = State.incidents.filter(inc => !inc.resolved);
      if (unresolved.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.className = 'empty-state';
        emptyP.textContent = 'No incidents logged currently. Stadium operations normal.';
        this.elements.incidentList.appendChild(emptyP);
        this.elements.incidentsLayer.replaceChildren();
        return;
      }

      unresolved.forEach(inc => {
        const card = document.createElement('div');
        card.className = 'incident-card';

        const header = document.createElement('div');
        header.className = 'incident-header';
        
        const title = document.createElement('h3');
        title.style.fontSize = '1.05rem';
        title.style.color = '#fff';
        title.textContent = `${inc.category} at ${inc.location}`;
        
        const priorityTag = document.createElement('span');
        priorityTag.className = `incident-tag tag-${inc.priority.toLowerCase()}`;
        priorityTag.textContent = inc.priority;
        
        header.appendChild(title);
        header.appendChild(priorityTag);

        const desc = document.createElement('p');
        desc.style.fontSize = '0.85rem';
        desc.style.color = 'var(--text-muted)';
        desc.textContent = inc.desc;

        const dispatchText = document.createElement('div');
        dispatchText.className = 'incident-dispatch';
        dispatchText.textContent = inc.dispatch;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.marginTop = '8px';
        
        const resolveBtn = document.createElement('button');
        resolveBtn.className = 'btn secondary-btn';
        resolveBtn.style.padding = '6px 12px';
        resolveBtn.style.fontSize = '0.8rem';
        resolveBtn.textContent = 'Mark Resolved';
        resolveBtn.addEventListener('click', () => window.StadiumPulse.resolveIncident(inc.id));
        footer.appendChild(resolveBtn);

        card.appendChild(header);
        card.appendChild(desc);
        card.appendChild(dispatchText);
        card.appendChild(footer);
        
        this.elements.incidentList.appendChild(card);
      });

      // Update the pulsing circles on SVG map
      this.renderMapIncidents();
    },

    // Inject SVG pulsing dots for map representation
    renderMapIncidents() {
      this.elements.incidentsLayer.replaceChildren();
      State.incidents.filter(inc => !inc.resolved).forEach(inc => {
        if (inc.coords) {
          // Dynamic SVG elements
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Outer expanding halo circle
          const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          outerCircle.setAttribute('cx', inc.coords.x);
          outerCircle.setAttribute('cy', inc.coords.y);
          outerCircle.setAttribute('r', 8);
          outerCircle.setAttribute('class', 'map-pulse-circle');
          
          // Inner fixed point circle
          const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          innerCircle.setAttribute('cx', inc.coords.x);
          innerCircle.setAttribute('cy', inc.coords.y);
          innerCircle.setAttribute('r', 5);
          innerCircle.setAttribute('fill', 'var(--danger-color)');
          innerCircle.style.animation = 'pulseDotFixed 1.5s infinite';
          
          group.appendChild(outerCircle);
          group.appendChild(innerCircle);
          this.elements.incidentsLayer.appendChild(group);
        }
      });
    },

    // Renders the eco scores & badges
    renderEcoDashboard() {
      this.elements.carbonSavedText.textContent = `${State.ecoCarbonSaved.toFixed(1)} kg`;
      this.elements.greenPointsText.textContent = State.ecoPoints;

      // Update progress bar and level text
      const percentage = (State.ecoPoints / 35) * 100;
      const bar = document.getElementById('eco-progress-bar');
      const lvlText = document.getElementById('eco-level-text');
      if (bar) bar.style.width = `${percentage}%`;
      if (lvlText) {
        let level = 1;
        if (State.ecoPoints >= 35) level = 3;
        else if (State.ecoPoints >= 25) level = 2;
        lvlText.textContent = `Level ${level} (${State.ecoPoints} / 35 pts)`;
      }

      // Determine badge unlocks
      this.elements.badgesContainer.replaceChildren();
      if (State.ecoPoints >= 10) {
        this.elements.badgesContainer.appendChild(this.createBadge('Eco Spectator'));
      }
      if (State.ecoPoints >= 25) {
        this.elements.badgesContainer.appendChild(this.createBadge('Transit Champion'));
      }
      if (State.ecoPoints >= 35) {
        this.elements.badgesContainer.appendChild(this.createBadge('Zero-Waste Hero'));
      }
      
      if (State.ecoPoints === 0) {
        const pl = document.createElement('span');
        pl.style.fontSize = '0.85rem';
        pl.style.color = 'var(--text-muted)';
        pl.style.fontStyle = 'italic';
        pl.textContent = 'Complete challenge items to earn tournament badges!';
        this.elements.badgesContainer.appendChild(pl);
      }
    },

    createBadge(text) {
      const el = document.createElement('span');
      el.className = 'badge-pill';
      el.textContent = `🏆 ${text}`;
      return el;
    },

    // Sync HTML SVG stand fill levels with active state density levels
    updateMapAesthetics() {
      Object.keys(State.stadiumState.stands).forEach(stand => {
        const level = State.stadiumState.stands[stand]; // 'low', 'medium', 'high', 'critical'
        const standLetter = stand.charAt(stand.length - 1);
        const mapEl = document.getElementById(`map-stand-${standLetter}`);
        if (mapEl) {
          mapEl.className.baseVal = `map-stand level-${level}`;
        }
      });

      // Update gates line colors based on wait times
      Object.keys(State.stadiumState.gates).forEach(gate => {
        const wait = State.stadiumState.gates[gate];
        const gateLetter = gate.charAt(gate.length - 1);
        const gateEl = document.getElementById(`map-gate-${gateLetter}`);
        if (gateEl) {
          if (wait <= 10) {
            gateEl.style.stroke = 'var(--primary-color)';
          } else if (wait <= 20) {
            gateEl.style.stroke = 'var(--warning-color)';
          } else {
            gateEl.style.stroke = 'var(--danger-color)';
          }
        }
      });
    },

    // Updates operations advisor recommendation widgets
    updateOpsPanel() {
      // 1. Dynamic alerts board
      this.elements.alertsBoard.replaceChildren();
      let highWaitGates = Object.entries(State.stadiumState.gates).filter(([_, wait]) => wait > 20);
      let highDensityStands = Object.entries(State.stadiumState.stands).filter(([_, level]) => level === 'high' || level === 'critical');
      let activeUnresolved = State.incidents.filter(inc => !inc.resolved);

      if (highWaitGates.length === 0 && highDensityStands.length === 0 && activeUnresolved.length === 0) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert success';
        alertDiv.textContent = '🟢 No operational alerts. Stadium status green.';
        this.elements.alertsBoard.appendChild(alertDiv);
        this.elements.globalAlert.classList.add('hidden');
      } else {
        // Build alert board
        highWaitGates.forEach(([gate, wait]) => {
          const div = document.createElement('div');
          div.className = 'alert warning';
          div.textContent = `⚠️ Queue bottleneck at ${gate}: Wait time is ${wait} minutes.`;
          this.elements.alertsBoard.appendChild(div);
        });

        highDensityStands.forEach(([stand, level]) => {
          const div = document.createElement('div');
          div.className = 'alert error';
          div.textContent = `🚨 High Spectator density at ${stand} (${level.toUpperCase()}).`;
          this.elements.alertsBoard.appendChild(div);
        });

        activeUnresolved.forEach(inc => {
          const div = document.createElement('div');
          div.className = `alert ${inc.priority === 'Critical' ? 'error' : 'warning'}`;
          div.textContent = `🔥 Incident: ${inc.category} at ${inc.location} requires triage dispatch.`;
          this.elements.alertsBoard.appendChild(div);
        });

        // Set global alert bar top banner
        this.elements.globalAlert.className = 'alert error';
        this.elements.globalAlert.textContent = `🏟️ Active Operations Advisories: ${highWaitGates.length} queue warnings | ${highDensityStands.length} crowd anomalies | ${activeUnresolved.length} logged incident safety reports.`;
        this.elements.globalAlert.classList.remove('hidden');
      }
    },

    resetChatGreeting() {
      this.elements.chatMessages.replaceChildren();
      let role = "";
      let status = "Zero-Setup Simulator Mode";
      if (State.apiKey && State.apiKey.trim() !== "") {
        status = State.apiKey.startsWith("AQ.") ? "AI21 Jamba Live Active" : "Gemini Live Active";
      }
      this.elements.chatModeBadge.textContent = status;

      let greetMsg = "";
      
      if (State.activeView === 'fan') {
        role = "⚽ Fan Concierge";
        greetMsg = "Welcome to the World Cup 2026 Fan Portal! Ask me anything about gate wait times, concession maps, restrooms, shuttle schedules, or accessible paths. You can also write in multiple languages (Spanish, French, Arabic, etc.).";
        this.elements.chatWindow.className = 'glass-panel chat-window';
        this.elements.chatToggle.className = 'chat-toggle-btn';
      } else if (State.activeView === 'staff') {
        role = "📋 Staff Triage Assistant";
        greetMsg = "Volunteer Operations Desk online. Describe any incident reported on the stadium floor, and I will instantly run a triage breakdown, priority rating, and deploy dispatch directives for field squads.";
        this.elements.chatWindow.className = 'glass-panel chat-window staff-mode-active';
        this.elements.chatToggle.className = 'chat-toggle-btn staff-chat';
      } else if (State.activeView === 'ops') {
        role = "🚨 Ops Command Co-Pilot";
        greetMsg = "Operations Command Room Co-Pilot ready. Ask me to synthesize recent incident reports, check stand densities, or recommend traffic load-balancing redirections.";
        this.elements.chatWindow.className = 'glass-panel chat-window ops-mode-active';
        this.elements.chatToggle.className = 'chat-toggle-btn ops-chat';
      }

      this.elements.chatRoleTitle.textContent = role;
      
      const welcomeBubble = document.createElement('div');
      welcomeBubble.className = 'message ai-message';
      welcomeBubble.textContent = greetMsg;
      this.elements.chatMessages.appendChild(welcomeBubble);
    }
  };

  // ==========================================
  // 4. ACTION HANDLERS
  // ==========================================
  
  // Tab Switcher
  const switchView = (view) => {
    State.activeView = view;
    
    // Manage display active states
    UI.elements.fanView.classList.add('hidden');
    UI.elements.staffView.classList.add('hidden');
    UI.elements.opsView.classList.add('hidden');
    
    UI.elements.btnFan.classList.remove('active');
    UI.elements.btnStaff.classList.remove('active', 'staff');
    UI.elements.btnOps.classList.remove('active', 'ops');
    
    UI.elements.btnFan.setAttribute('aria-selected', 'false');
    UI.elements.btnStaff.setAttribute('aria-selected', 'false');
    UI.elements.btnOps.setAttribute('aria-selected', 'false');
    
    if (view === 'fan') {
      UI.elements.fanView.classList.remove('hidden');
      UI.elements.btnFan.classList.add('active');
      UI.elements.btnFan.setAttribute('aria-selected', 'true');
    } else if (view === 'staff') {
      UI.elements.staffView.classList.remove('hidden');
      UI.elements.btnStaff.classList.add('active', 'staff');
      UI.elements.btnStaff.setAttribute('aria-selected', 'true');
    } else if (view === 'ops') {
      UI.elements.opsView.classList.remove('hidden');
      UI.elements.btnOps.classList.add('active', 'ops');
      UI.elements.btnOps.setAttribute('aria-selected', 'true');
    }
    
    // Refresh chat layout to align personality
    UI.resetChatGreeting();
  };

  // Save Gemini Key
  const saveSettings = () => {
    const key = UI.elements.settingsKeyInput.value.trim();
    State.apiKey = key;
    localStorage.setItem('stadiumpulse_api_key', key);
    UI.elements.settingsModal.classList.add('hidden');
    UI.resetChatGreeting();
    const wrapper = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = 'AI interface has been successfully refreshed with your new settings.';
    wrapper.appendChild(p);
    showInfoModal('⚙️ Configuration Saved', wrapper);
  };

  // Toggle Chat Popup
  const toggleChat = () => {
    const isHidden = UI.elements.chatWindow.classList.toggle('hidden');
    UI.elements.chatToggle.setAttribute('aria-expanded', !isHidden);
  };

  // Toggle Chat Minimize State
  const toggleMinimizeChat = (e) => {
    if (e) e.stopPropagation();
    const chatWin = UI.elements.chatWindow;
    const minBtn = document.getElementById('chat-minimize-btn');
    const isMin = chatWin.classList.toggle('minimized');
    minBtn.textContent = isMin ? '🔲' : '➖';
    minBtn.title = isMin ? 'Restore chat' : 'Minimize chat';
  };

  // Sustainability challenge updates
  const updateEcoScore = () => {
    let pts = 0;
    let co2 = 0.0;
    
    if (document.getElementById('eco-check-transit').checked) {
      pts += 15;
      co2 += 2.4;
    }
    if (document.getElementById('eco-check-recycle').checked) {
      pts += 10;
      co2 += 0.6;
    }
    if (document.getElementById('eco-check-bottle').checked) {
      pts += 10;
      co2 += 0.5;
    }

    const oldBadges = [];
    if (State.ecoPoints >= 10) oldBadges.push('Eco Spectator');
    if (State.ecoPoints >= 25) oldBadges.push('Transit Champion');
    if (State.ecoPoints >= 35) oldBadges.push('Zero-Waste Hero');

    State.ecoPoints = pts;
    State.ecoCarbonSaved = co2;
    localStorage.setItem('stadiumpulse_eco_points', pts);
    localStorage.setItem('stadiumpulse_eco_carbon', co2);

    UI.renderEcoDashboard();

    const newBadges = [];
    if (State.ecoPoints >= 10) newBadges.push('Eco Spectator');
    if (State.ecoPoints >= 25) newBadges.push('Transit Champion');
    if (State.ecoPoints >= 35) newBadges.push('Zero-Waste Hero');

    const unlocked = newBadges.filter(b => !oldBadges.includes(b));
    if (unlocked.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.style.textAlign = 'center';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '16px';
      wrapper.style.padding = '8px';

      const trophy = document.createElement('div');
      trophy.style.fontSize = '4rem';
      trophy.style.animation = 'floatOrb 2s ease-in-out infinite';
      trophy.style.transformOrigin = 'center';
      trophy.textContent = '🏆';
      wrapper.appendChild(trophy);

      const h3 = document.createElement('h3');
      h3.textContent = 'Green Badge Unlocked!';
      wrapper.appendChild(h3);

      const p1 = document.createElement('p');
      p1.appendChild(document.createTextNode('Congratulations! You have earned the '));
      const bText = document.createElement('strong');
      bText.textContent = unlocked[0];
      p1.appendChild(bText);
      p1.appendChild(document.createTextNode(' badge for your sustainable choices.'));
      wrapper.appendChild(p1);

      const pillContainer = document.createElement('div');
      pillContainer.style.margin = '12px auto';
      pillContainer.style.display = 'inline-block';
      const pill = document.createElement('div');
      pill.className = 'badge-pill';
      pill.textContent = `🏆 ${unlocked[0]}`;
      pillContainer.appendChild(pill);
      wrapper.appendChild(pillContainer);

      const p2 = document.createElement('p');
      p2.style.fontSize = '0.85rem';
      p2.style.color = 'var(--text-muted)';
      p2.textContent = 'Thank you for helping us make the 2026 World Cup green!';
      wrapper.appendChild(p2);

      showInfoModal('🎉 Achievement Unlocked!', wrapper);
    }
  };

  // Calculate dynamic travel routing
  const calculateTransitRoute = async () => {
    try {
      const mode = UI.elements.routeSelector.value;
      let prompt = `Plan transit route and calculate eco-impact metrics for route option: ${mode}. Wait times: Transit = 4 min, Shuttle = 6 min (delays), Walk = clear, Rideshare = 20 min wait.`;
      let systemPrompt = "You are the Stadium Transit Planner. Explain travel route directions, estimated time, and carbon efficiency. Keep the response under 100 words.";

      UI.elements.routeOutput.classList.remove('hidden');
      UI.elements.routeOutput.className = 'alert warning';
      UI.elements.routeOutput.textContent = 'AI Computing route efficiency...';

      const aiRes = await GenAIService.callAI(prompt, systemPrompt);
      
      UI.elements.routeOutput.className = 'alert success';
      renderSanitizedMarkdown(UI.elements.routeOutput, `**AI Transit Advice:**\n${aiRes.content}`);
    } catch (e) {
      console.error("Transit Route Calculation Error:", e);
      UI.elements.routeOutput.className = 'alert danger';
      UI.elements.routeOutput.textContent = `Error: ${e.message}`;
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to compute transit route: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Transit Calculation Error", wrapper);
    }
  };

  // Wayfinder Engine
  const handleWayfinding = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    try {
      const fromVal = UI.elements.wayfinderFrom.value;
      const toVal = UI.elements.wayfinderTo.value;
      const accessible = UI.elements.wayfinderAccessible.checked;

      // Detect bottlenecks dynamically from state
      let standsStateSummary = Object.entries(State.stadiumState.stands)
        .map(([stand, level]) => `${stand} is ${level.toUpperCase()}`)
        .join(', ');
      
      let prompt = `Find step-by-step pedestrian path from ${fromVal} to ${toVal}. Spectator density status: ${standsStateSummary}. Accessibility needs: ${accessible ? 'Yes (Wheelchair accessibility required)' : 'No'}. Redirect paths if stands on the normal route are crowded.`;
      let systemPrompt = "You are the Stadium Wayfinding AI. Direct spectators inside the venue avoiding high-density zones. List 3 simple steps. Keep it very clear.";

      UI.elements.wayfinderResult.classList.remove('hidden');
      UI.elements.wayfinderResult.className = 'alert warning';
      UI.elements.wayfinderSteps.textContent = 'Computing optimal path avoiding high density...';

      // Highlight route on map
      let gateL = fromVal.includes("Gate A") ? "A" : fromVal.includes("Gate B") ? "B" : fromVal.includes("Gate C") ? "C" : fromVal.includes("Gate D") ? "D" : fromVal.includes("Gate E") ? "E" : fromVal.includes("Gate F") ? "F" : "";
      let standL = toVal.includes("Stand A") ? "A" : toVal.includes("Stand B") ? "B" : toVal.includes("Stand C") ? "C" : toVal.includes("Stand D") ? "D" : "";
      highlightRoute(gateL, standL);

      const aiRes = await GenAIService.callAI(prompt, systemPrompt);
      
      UI.elements.wayfinderResult.className = 'alert success';
      UI.elements.wayfinderRouteTitle.textContent = `Route: ${fromVal} ➔ ${toVal} ${accessible ? '(Accessible Path)' : ''}`;
      UI.elements.wayfinderSteps.textContent = aiRes.content;
    } catch (e) {
      console.error("Wayfinding Error:", e);
      UI.elements.wayfinderResult.className = 'alert danger';
      UI.elements.wayfinderSteps.textContent = `Error: ${e.message}`;
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to compute wayfinding steps: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Wayfinding Error", wrapper);
    }
  };

  // Generate public announcements in multiple languages
  const generateAnnouncement = async () => {
    try {
      const topic = UI.elements.annTopic.value.trim();
      if (!topic) {
        const wrapper = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = 'Please input a topic or reference incident for the announcement.';
        wrapper.appendChild(p);
        showInfoModal('⚠️ Input Required', wrapper);
        return;
      }
      const lang = UI.elements.annLang.value;
      const tone = UI.elements.annTone.value;

      let prompt = `Create a stadium PA announcement about: "${topic}". Language: ${lang}. Tone: ${tone}.`;
      let systemPrompt = `You are the Head Operations Announcer at the FIFA World Cup 2026. Write a public announcement that matches the specified language and tone. Keep the copy short, professional, and clear for stadium speakers. Do not translate the name of the stadium.`;

      UI.elements.annOutput.classList.remove('hidden');
      UI.elements.annOutput.className = 'alert warning';
      UI.elements.annText.textContent = 'AI generating announcement copy...';

      const aiRes = await GenAIService.callAI(prompt, systemPrompt);

      UI.elements.annOutput.className = 'alert success';
      UI.elements.annText.textContent = aiRes.content;
    } catch (e) {
      console.error("Announcement Generation Error:", e);
      UI.elements.annOutput.className = 'alert danger';
      UI.elements.annText.textContent = `Error: ${e.message}`;
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to generate announcement: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Generation Error", wrapper);
    }
  };

  // Triage incident log submit
  const handleLogIncident = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    try {
      const loc = UI.elements.incidentLoc.value;
      const cat = UI.elements.incidentCat.value;
      const desc = UI.elements.incidentDesc.value;

      // Call Triage AI to compute Priority & Dispatch action plan
      let prompt = `Triage report details:\nLocation: ${loc}\nCategory: ${cat}\nIncident Description: ${desc}`;
      let systemPrompt = "You are the Stadium Incident Triage AI. Determine priority (Low, Medium, or High) and write a one-sentence volunteer Dispatch Action Plan. Respond in the format: 'Priority: [PriorityLevel]. Action: [Dispatch instructions]'.";

      // Show temporary overlay on button or list
      const logBtn = UI.elements.incidentForm.querySelector('button');
      const originalText = logBtn.textContent;
      logBtn.textContent = 'AI Triaging Incident...';
      logBtn.disabled = true;

      const aiRes = await GenAIService.callAI(prompt, systemPrompt);

      logBtn.textContent = originalText;
      logBtn.disabled = false;

      // Parse priority
      let priority = 'Medium';
      if (aiRes.content.includes('Priority: High') || aiRes.content.includes('High')) {
        priority = 'High';
      } else if (aiRes.content.includes('Priority: Critical') || aiRes.content.includes('Critical')) {
        priority = 'Critical';
      } else if (aiRes.content.includes('Priority: Low') || aiRes.content.includes('Low')) {
        priority = 'Low';
      }

      // Determine map coordinates
      let coords = State.coordMap[loc] || { x: 200, y: 200 };
      
      // Add to active incident list
      const newInc = {
        id: Date.now(),
        location: loc,
        category: cat,
        desc: desc,
        priority: priority,
        dispatch: aiRes.content,
        resolved: false,
        coords: coords
      };

      State.incidents.push(newInc);
      UI.renderIncidents();
      UI.updateOpsPanel();
      UI.elements.incidentForm.reset();

      // Alert completion
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '12px';
      const p1 = document.createElement('p');
      p1.appendChild(document.createTextNode('Incident successfully logged and prioritized by AI as '));
      const prStrong = document.createElement('strong');
      prStrong.textContent = priority;
      p1.appendChild(prStrong);
      p1.appendChild(document.createTextNode('.'));
      wrapper.appendChild(p1);
      const p2 = document.createElement('p');
      p2.textContent = 'Operational team has been dispatched.';
      wrapper.appendChild(p2);
      showInfoModal('⚠️ Incident Logged', wrapper);
    } catch (e) {
      console.error("Incident Logging Error:", e);
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to log incident: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Incident Logging Error", wrapper);
    }
  };

  // Resolve incident
  const resolveIncident = (id) => {
    const inc = State.incidents.find(i => i.id === id);
    if (inc) {
      inc.resolved = true;
      UI.renderIncidents();
      UI.updateOpsPanel();
    }
  };

  // Simulator Scenario Trigger
  const triggerScenario = async (scenario) => {
    try {
      State.activeScenario = scenario;
      
      // Clean old active states on simulation buttons
      document.querySelectorAll('.sim-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById(`sim-btn-${scenario}`);
      if (activeBtn) activeBtn.classList.add('active');

      let copilotPrompt = "";
      
      if (scenario === 'normal') {
        State.stadiumState.stands['Stand A'] = 'low';
        State.stadiumState.stands['Stand B'] = 'low';
        State.stadiumState.stands['Stand C'] = 'medium';
        State.stadiumState.stands['Stand D'] = 'low';
        
        State.stadiumState.gates['Gate A'] = 10;
        State.stadiumState.gates['Gate B'] = 15;
        State.stadiumState.gates['Gate C'] = 12;
        State.stadiumState.gates['Gate D'] = 8;
        
        copilotPrompt = "Analyze normal stadium conditions. 10m gate wait times. Medium crowd in Stand C. No issues.";
      } else if (scenario === 'exit') {
        State.stadiumState.stands['Stand A'] = 'high';
        State.stadiumState.stands['Stand B'] = 'medium';
        State.stadiumState.stands['Stand C'] = 'critical';
        State.stadiumState.stands['Stand D'] = 'medium';
        
        State.stadiumState.gates['Gate A'] = 35;
        State.stadiumState.gates['Gate B'] = 45;
        State.stadiumState.gates['Gate C'] = 50;
        State.stadiumState.gates['Gate D'] = 20;

        copilotPrompt = "Analyze post-match exit rush. Critical crowd levels in Stand C, High in Stand A. Wait times at Gate B & C exceed 45 minutes.";
      } else if (scenario === 'gate-failure') {
        State.stadiumState.stands['Stand B'] = 'high';
        
        State.stadiumState.gates['Gate B'] = 55; // scanner failed
        State.stadiumState.gates['Gate F'] = 10;
        
        copilotPrompt = "Analyze outage: Gate B scanner malfunction causing 55 min queue. Nearby Gate F (Accessibility/South-East) queue is only 10 mins.";
      } else if (scenario === 'stand-concession') {
        State.stadiumState.stands['Stand C'] = 'critical'; // concession bottleneck
        
        copilotPrompt = "Analyze Stand C concession corridor blockage. Food queues blocking exit rows causing crowd safety warnings.";
      }

      // Refresh visuals
      UI.updateMapAesthetics();
      UI.updateOpsPanel();

      // Call Ops Co-pilot AI to update recommendations block
      UI.elements.copilotAdvice.replaceChildren();
      const em = document.createElement('em');
      em.textContent = 'AI Co-Pilot analyzing scenario metrics...';
      UI.elements.copilotAdvice.appendChild(em);

      let systemPrompt = "You are the Stadium Operations AI Co-Pilot. Write a highly tactical load-balancing plan based on the scenario metrics provided. Provide 3 specific actions using bold lists. Limit response to 120 words.";
      
      const aiRes = await GenAIService.callAI(copilotPrompt, systemPrompt);
      renderSanitizedMarkdown(UI.elements.copilotAdvice, `**CO-PILOT RESPONSE PLAN:**\n${aiRes.content}`);

      // Update chatbot view if in ops mode currently
      if (State.activeView === 'ops') {
        UI.resetChatGreeting();
      }
    } catch (e) {
      console.error("Scenario Trigger Error:", e);
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to run simulator scenario: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Simulator Error", wrapper);
    }
  };

  // Chat Submissions (Floating Chat Panel)
  const handleChatSubmit = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    try {
      const input = UI.elements.chatInput.value.trim();
      if (!input) return;

      // Render User bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'message user-message';
      userBubble.textContent = input;
      UI.elements.chatMessages.appendChild(userBubble);
      
      UI.elements.chatInput.value = '';
      UI.elements.chatMessages.scrollTop = UI.elements.chatMessages.scrollHeight;

      // Show loading
      const loadBubble = document.createElement('div');
      loadBubble.className = 'message ai-message';
      loadBubble.textContent = 'Thinking...';
      UI.elements.chatMessages.appendChild(loadBubble);
      UI.elements.chatMessages.scrollTop = UI.elements.chatMessages.scrollHeight;

      // Formulate Context Prompt based on View
      let systemInstruction = "";
      if (State.activeView === 'fan') {
        systemInstruction = "You are the helpful Fan Concierge chatbot for StadiumPulse 2026. Suggest public transit, seat navigation paths, concession spots, or green badges. Match user language.";
      } else if (State.activeView === 'staff') {
        systemInstruction = "You are the Incident Triage Assistant for StadiumPulse. Provide priority ratings and deployment dispatch directives for logged field incidents.";
      } else if (State.activeView === 'ops') {
        systemInstruction = "You are the Operations Command Co-Pilot. Analyze crowd densities, gate wait times, and recommend load balancing strategies.";
      }

      const aiRes = await GenAIService.callAI(input, systemInstruction);

      // Remove loading
      UI.elements.chatMessages.removeChild(loadBubble);

      // If there is reasoning / chain-of-thought thought blocks, render it!
      if (aiRes.thought) {
        const thoughtDiv = document.createElement('div');
        thoughtDiv.className = 'thought-block';
        thoughtDiv.textContent = aiRes.thought;
        UI.elements.chatMessages.appendChild(thoughtDiv);
      }

      // Render AI Response bubble
      const aiBubble = document.createElement('div');
      aiBubble.className = 'message ai-message';
      aiBubble.textContent = aiRes.content;
      UI.elements.chatMessages.appendChild(aiBubble);

      UI.elements.chatMessages.scrollTop = UI.elements.chatMessages.scrollHeight;
    } catch (e) {
      console.error("Chat Submit Error:", e);
      const wrapper = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = `Failed to send query: ${e.message}`;
      wrapper.appendChild(p);
      showInfoModal("⚠️ Chat Error", wrapper);
    }
  };

  // Map click triggers detail popups
  const showStandDetails = (stand) => {
    const standLetter = stand.charAt(stand.length - 1);
    highlightSVGElement('map-stand-' + standLetter);
    const density = State.stadiumState.stands[stand];
    const status = density === 'critical' || density === 'high' ? 'Deploying crowd redirects' : 'Normal flow';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '12px';
    wrapper.style.fontSize = '0.95rem';

    const p1 = document.createElement('p');
    const s1 = document.createElement('strong');
    s1.textContent = 'Stand: ';
    p1.appendChild(s1);
    p1.appendChild(document.createTextNode(stand));
    wrapper.appendChild(p1);

    const p2 = document.createElement('p');
    const s2 = document.createElement('strong');
    s2.textContent = 'Crowd Density: ';
    p2.appendChild(s2);
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = density === 'critical' ? 'var(--danger-color)' : density === 'high' ? 'var(--warning-color)' : 'var(--primary-color)';
    badge.style.color = '#000';
    badge.style.padding = '4px 8px';
    badge.style.borderRadius = '4px';
    badge.style.fontWeight = 'bold';
    badge.textContent = density.toUpperCase();
    p2.appendChild(badge);
    wrapper.appendChild(p2);

    const p3 = document.createElement('p');
    const s3 = document.createElement('strong');
    s3.textContent = 'Status: ';
    p3.appendChild(s3);
    p3.appendChild(document.createTextNode(status));
    wrapper.appendChild(p3);

    showInfoModal(`🔍 Stand Information`, wrapper);
  };

  const showGateDetails = (gate) => {
    const gateLetter = gate.charAt(gate.length - 1);
    highlightSVGElement('map-gate-' + gateLetter);
    const wait = State.stadiumState.gates[gate] || 5;
    const status = wait > 30 ? 'CRITICAL - Re-routing advised' : 'Normal wait';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '12px';
    wrapper.style.fontSize = '0.95rem';

    const p1 = document.createElement('p');
    const s1 = document.createElement('strong');
    s1.textContent = 'Gate: ';
    p1.appendChild(s1);
    p1.appendChild(document.createTextNode(gate));
    wrapper.appendChild(p1);

    const p2 = document.createElement('p');
    const s2 = document.createElement('strong');
    s2.textContent = 'Wait Time: ';
    p2.appendChild(s2);
    const valSpan = document.createElement('span');
    valSpan.style.fontSize = '1.1rem';
    valSpan.style.fontWeight = 'bold';
    valSpan.style.color = wait > 30 ? 'var(--danger-color)' : wait > 15 ? 'var(--warning-color)' : 'var(--primary-color)';
    valSpan.textContent = `${wait} minutes`;
    p2.appendChild(valSpan);
    wrapper.appendChild(p2);

    const p3 = document.createElement('p');
    const s3 = document.createElement('strong');
    s3.textContent = 'Status: ';
    p3.appendChild(s3);
    p3.appendChild(document.createTextNode(status));
    wrapper.appendChild(p3);

    showInfoModal(`🔍 Gate Information`, wrapper);
  };

  // Bootstrap Init
  return {
    _state: State,
    _sanitize: sanitizeAndFormat,
    start() {
      UI.init();
      // Start in default normal scenario to populate advisor at load
      triggerScenario('normal');
    },
    switchView,
    saveSettings,
    toggleChat,
    toggleMinimizeChat,
    updateEcoScore,
    calculateTransitRoute,
    handleWayfinding,
    generateAnnouncement,
    handleLogIncident,
    resolveIncident,
    triggerScenario,
    handleChatSubmit,
    showStandDetails,
    showGateDetails
  };
})();

document.addEventListener('DOMContentLoaded', () => window.StadiumPulse.start());
