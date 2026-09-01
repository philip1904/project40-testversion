/*
  PROJECT 40 — MODES ADD-ON v1

  Byggd ovanpå den fungerande PROJECT 40-versionen.

  LÄGEN:
  - NORMAL
  - AXEL
  - KONTOR: huvuduppgift + 5:00 planka + 2:00 wall sit
  - SKADAD / SLITEN: 15 000 steg ersätter hela dagen

  Kräver inga nya Supabase-kolumner.
  Extra data lagras som metadata i plank_sets JSONB.
*/

(() => {

  "use strict";


  /* ========================================
     SAVE ORIGINAL FUNCTIONS
     ======================================== */

  const baseRenderDay =
    renderDay;

  const baseProgressComplete =
    progressComplete;

  const baseProgressPartial =
    progressPartial;

  const baseTodayStatusText =
    todayStatusText;

  const baseShareStatus =
    shareStatus;

  const baseResetToday =
    resetToday;

  const baseAddBmu =
    addBmu;


  /* ========================================
     METADATA
     ======================================== */

  function p40Meta(row){

    if(
      !row ||
      !Array.isArray(row.plank_sets)
    ){

      return {
        mode:"normal",
        office_seconds:0,
        steps:0
      };

    }


    const found =
      row.plank_sets.find(
        item =>
          item &&
          typeof item === "object" &&
          item.__p40_modes === 1
      );


    return {

      mode:
        [
          "normal",
          "shoulder",
          "office",
          "recovery"
        ].includes(found?.mode)
          ?
          found.mode
          :
          "normal",

      office_seconds:
        Math.max(
          0,
          Math.min(
            120,
            Number(
              found?.office_seconds || 0
            )
          )
        ),

      steps:
        Math.max(
          0,
          Math.min(
            15000,
            Number(
              found?.steps || 0
            )
          )
        )

    };

  }


  function p40NumericPlankSets(row){

    if(
      !row ||
      !Array.isArray(row.plank_sets)
    ){

      return [];

    }


    return row.plank_sets.filter(
      value =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );

  }


  function p40SetMeta(
    row,
    patch
  ){

    if(!row){
      return;
    }


    const old =
      p40Meta(row);


    const next = {
      ...old,
      ...patch
    };


    row.plank_sets = [

      ...p40NumericPlankSets(row),

      {
        __p40_modes:1,

        mode:
          next.mode || "normal",

        office_seconds:
          Math.max(
            0,
            Math.min(
              120,
              Number(
                next.office_seconds || 0
              )
            )
          ),

        steps:
          Math.max(
            0,
            Math.min(
              15000,
              Number(
                next.steps || 0
              )
            )
          )
      }

    ];

  }


  function p40Mode(row){

    if(!row){
      return "normal";
    }


    const meta =
      p40Meta(row);


    if(
      meta.mode !== "normal"
    ){

      return meta.mode;

    }


    /*
      Kompatibilitet med det befintliga
      axelläget från gamla versionen.
    */

    if(
      row === todayProgress &&
      typeof getShoulderState === "function" &&
      getShoulderState()?.enabled
    ){

      return "shoulder";

    }


    return "normal";

  }


  /* ========================================
     CSS
     ======================================== */

  function p40InjectStyles(){

    if(
      document.getElementById(
        "p40ModesStyles"
      )
    ){
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "p40ModesStyles";


    style.textContent = `

      .p40-mode-card{
        border-color:rgba(245,197,24,.28);
      }

      .p40-mode-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:15px;
      }

      .p40-mode-button{
        min-height:67px;
        border:1px solid var(--line);
        border-radius:14px;
        padding:9px 6px;
        background:#101012;
        color:var(--muted);
        font-size:11px;
        font-weight:950;
        line-height:1.3;
      }

      .p40-mode-button.active{
        border-color:var(--yellow);
        background:rgba(245,197,24,.1);
        color:var(--yellow);
      }

      .p40-mode-info{
        margin-top:12px;
        padding:11px;
        border-radius:12px;
        background:#101012;
        color:#cfcfd3;
        font-size:12px;
        line-height:1.5;
      }

      .p40-office-card{
        border-color:rgba(121,184,255,.4);
        background:rgba(121,184,255,.05);
      }

      .p40-recovery-card{
        border-color:rgba(57,217,138,.42);
        background:rgba(57,217,138,.05);
      }

      .p40-alt-icon{
        font-size:38px;
        margin-bottom:10px;
      }

      .p40-warning{
        margin-top:14px;
        padding:12px;
        border-radius:13px;
        background:rgba(255,191,105,.08);
        border:1px solid rgba(255,191,105,.25);
        color:#ffd19b;
        font-size:12px;
        line-height:1.5;
      }

      .p40-office-buttons,
      .p40-step-buttons{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
        margin-top:16px;
      }

      .p40-step-buttons .btn{
        padding-left:4px;
        padding-right:4px;
        font-size:12px;
      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* ========================================
     CREATE UI
     ======================================== */

  function p40EnsureUI(){

    p40InjectStyles();


    const taskArea =
      document.getElementById(
        "taskArea"
      );


    if(!taskArea){
      return;
    }


    /*
      MODE SELECTOR
    */

    if(
      !document.getElementById(
        "p40ModeCard"
      )
    ){

      const card =
        document.createElement(
          "div"
        );


      card.id =
        "p40ModeCard";


      card.className =
        "card p40-mode-card";


      card.innerHTML = `

        <div class="card-title">

          <h2>
            DAGENS LÄGE
          </h2>

          <span
            id="p40ModeBadge"
            class="badge"
          >
            NORMAL
          </span>

        </div>


        <div class="p40-mode-grid">

          <button
            class="p40-mode-button"
            data-p40-mode="normal"
            onclick="setP40DayMode('normal')"
          >
            🦍<br>
            NORMAL
          </button>

          <button
            class="p40-mode-button"
            data-p40-mode="shoulder"
            onclick="setP40DayMode('shoulder')"
          >
            🩹<br>
            AXEL
          </button>

          <button
            class="p40-mode-button"
            data-p40-mode="office"
            onclick="setP40DayMode('office')"
          >
            🏢<br>
            INGEN STÅNG / RINGAR
          </button>

          <button
            class="p40-mode-button"
            data-p40-mode="recovery"
            onclick="setP40DayMode('recovery')"
          >
            ❤️‍🩹<br>
            SKADAD / SLITEN
          </button>

        </div>


        <div
          id="p40ModeInfo"
          class="p40-mode-info"
        ></div>

      `;


      const oldShoulder =
        document.getElementById(
          "shoulderToggleCard"
        );


      if(oldShoulder){

        taskArea.insertBefore(
          card,
          oldShoulder
        );

      }else{

        taskArea.prepend(
          card
        );

      }

    }


    /*
      OFFICE CARD
    */

    if(
      !document.getElementById(
        "p40OfficeCard"
      )
    ){

      const card =
        document.createElement(
          "div"
        );


      card.id =
        "p40OfficeCard";


      card.className =
        "card p40-office-card hidden";


      card.innerHTML = `

        <div class="p40-alt-icon">
          🏢
        </div>

        <div class="card-title">

          <h2>
            WALL SIT
          </h2>

          <span
            id="p40OfficeBadge"
            class="badge"
          >
            0:00 / 2:00
          </span>

        </div>


        <div
          id="p40OfficeNumber"
          class="big-number"
        >
          0:00
        </div>


        <div class="target">
          av 2:00 totalt
        </div>


        <div class="exercise-note">
          Ingen stång eller ringar?
          Gör dagens huvuduppgift och
          5:00 planka som vanligt.
          Dagens teknikdel ersätts av
          exakt 2:00 wall sit.
        </div>


        <div class="p40-office-buttons">

          <button
            class="btn"
            onclick="addP40OfficeSeconds(15)"
          >
            +15s
          </button>

          <button
            class="btn"
            onclick="addP40OfficeSeconds(30)"
          >
            +30s
          </button>

          <button
            class="btn primary"
            onclick="addP40OfficeSeconds(60)"
          >
            +60s
          </button>

          <button
            class="btn"
            onclick="setP40OfficeSeconds()"
          >
            ANGE
          </button>

        </div>

      `;


      const rulebox =
        taskArea.querySelector(
          ".rulebox"
        );


      if(rulebox){

        taskArea.insertBefore(
          card,
          rulebox
        );

      }else{

        taskArea.appendChild(
          card
        );

      }

    }


    /*
      RECOVERY CARD
    */

    if(
      !document.getElementById(
        "p40RecoveryCard"
      )
    ){

      const card =
        document.createElement(
          "div"
        );


      card.id =
        "p40RecoveryCard";


      card.className =
        "card p40-recovery-card hidden";


      card.innerHTML = `

        <div class="p40-alt-icon">
          ❤️‍🩹
        </div>

        <div class="card-title">

          <h2>
            15 000 STEG
          </h2>

          <span
            id="p40StepsBadge"
            class="badge"
          >
            0 / 15 000
          </span>

        </div>


        <div
          id="p40StepsNumber"
          class="big-number"
        >
          0
        </div>


        <div class="target">
          av 15 000 steg
        </div>


        <div class="exercise-note">
          Detta ersätter HELA dagens
          PROJECT 40.
          Ingen huvuduppgift, planka
          eller teknikdel behövs.
          Gå lugnt och gärna utspritt
          över dagen.
        </div>


        <div class="p40-warning">
          Använd detta när du faktiskt är
          skadad eller rejält sliten —
          inte som en enklare genväg.
          Gången ska vara smärtfri.
        </div>


        <div class="p40-step-buttons">

          <button
            class="btn"
            onclick="addP40Steps(1000)"
          >
            +1K
          </button>

          <button
            class="btn"
            onclick="addP40Steps(2500)"
          >
            +2.5K
          </button>

          <button
            class="btn primary"
            onclick="addP40Steps(5000)"
          >
            +5K
          </button>

          <button
            class="btn"
            onclick="setP40Steps()"
          >
            ANGE
          </button>

        </div>

      `;


      const rulebox =
        taskArea.querySelector(
          ".rulebox"
        );


      if(rulebox){

        taskArea.insertBefore(
          card,
          rulebox
        );

      }else{

        taskArea.appendChild(
          card
        );

      }

    }

  }


  /* ========================================
     MODE
     ======================================== */

  window.setP40DayMode =
    async function(mode){

      if(!todayProgress){
        return;
      }


      if(
        ![
          "normal",
          "shoulder",
          "office",
          "recovery"
        ].includes(mode)
      ){
        return;
      }


      const oldMode =
        p40Mode(
          todayProgress
        );


      if(
        oldMode === mode
      ){
        return;
      }


      if(
        activePlank()
      ){

        await stopPlank();

      }


      if(
        mode === "recovery"
      ){

        const ok =
          confirm(
`❤️‍🩹 SKADAD / SLITEN

15 000 steg ersätter HELA dagens PROJECT 40.

Ingen huvuduppgift, planka eller teknikdel behövs.

Detta ska användas när du faktiskt behöver anpassa dagen och bara om gång är smärtfri.

Aktivera 15K-läget?`
          );


        if(!ok){
          return;
        }

      }


      /*
        Om en tidigare axeldag hade
        markerats som färdig genom att
        BMU-värden sattes till target,
        återställs dessa när man lämnar
        axelläget.
      */

      const shoulderState =
        getShoulderState();


      if(
        oldMode === "shoulder" &&
        shoulderState?.bmuWaived
      ){

        todayProgress.bmu1_value =
          0;

        todayProgress.bmu2_value =
          0;

      }


      p40SetMeta(
        todayProgress,
        {
          mode
        }
      );


      saveShoulderState({

        enabled:
          mode === "shoulder",

        bmuWaived:false

      });


      renderDay();


      await saveToday();

    };


  /* ========================================
     OFFICE
     ======================================== */

  window.addP40OfficeSeconds =
    async function(amount){

      if(
        !todayProgress ||
        p40Mode(todayProgress) !==
          "office"
      ){
        return;
      }


      const meta =
        p40Meta(
          todayProgress
        );


      p40SetMeta(
        todayProgress,
        {
          office_seconds:
            Math.min(
              120,
              meta.office_seconds +
                amount
            )
        }
      );


      renderDay();


      await saveToday();

    };


  window.setP40OfficeSeconds =
    async function(){

      if(
        !todayProgress ||
        p40Mode(todayProgress) !==
          "office"
      ){
        return;
      }


      const meta =
        p40Meta(
          todayProgress
        );


      const value =
        prompt(
          "Ange antal sekunder wall sit:",
          String(
            meta.office_seconds
          )
        );


      if(
        value === null
      ){
        return;
      }


      const seconds =
        Number(
          String(value)
            .replace(/[^\d]/g,"")
        );


      if(
        !Number.isFinite(seconds)
      ){
        return;
      }


      p40SetMeta(
        todayProgress,
        {
          office_seconds:
            Math.max(
              0,
              Math.min(
                120,
                seconds
              )
            )
        }
      );


      renderDay();


      await saveToday();

    };


  /* ========================================
     STEPS
     ======================================== */

  window.addP40Steps =
    async function(amount){

      if(
        !todayProgress ||
        p40Mode(todayProgress) !==
          "recovery"
      ){
        return;
      }


      const meta =
        p40Meta(
          todayProgress
        );


      p40SetMeta(
        todayProgress,
        {
          steps:
            Math.min(
              15000,
              meta.steps +
                amount
            )
        }
      );


      renderDay();


      await saveToday();

    };


  window.setP40Steps =
    async function(){

      if(
        !todayProgress ||
        p40Mode(todayProgress) !==
          "recovery"
      ){
        return;
      }


      const meta =
        p40Meta(
          todayProgress
        );


      const value =
        prompt(
          "Ange dagens totala antal steg:",
          String(
            meta.steps
          )
        );


      if(
        value === null
      ){
        return;
      }


      const steps =
        Number(
          String(value)
            .replace(/[^\d]/g,"")
        );


      if(
        !Number.isFinite(steps)
      ){

        toast(
          "Ogiltigt antal steg."
        );

        return;
      }


      p40SetMeta(
        todayProgress,
        {
          steps:
            Math.max(
              0,
              Math.min(
                15000,
                steps
              )
            )
        }
      );


      renderDay();


      await saveToday();

    };


  /* ========================================
     COMPLETION
     ======================================== */

  progressComplete =
    function(
      row,
      date
    ){

      if(!row){
        return false;
      }


      const plan =
        trainingPlanForDate(
          date
        );


      if(!plan){
        return false;
      }


      const mode =
        p40Mode(
          row
        );


      const meta =
        p40Meta(
          row
        );


      if(
        mode === "recovery"
      ){

        return (
          meta.steps >=
          15000
        );

      }


      if(
        mode === "office"
      ){

        return (
          row.main_reps >=
            plan.main.target
          &&
          row.plank_seconds >=
            300
          &&
          meta.office_seconds >=
            120
        );

      }


      return baseProgressComplete(
        row,
        date
      );

    };


  progressPartial =
    function(row){

      if(!row){
        return false;
      }


      const meta =
        p40Meta(
          row
        );


      if(
        meta.mode !== "normal" ||
        meta.office_seconds > 0 ||
        meta.steps > 0
      ){

        return true;

      }


      return baseProgressPartial(
        row
      );

    };


  /* ========================================
     GROUP STATUS
     ======================================== */

  todayStatusText =
    function(row){

      if(!row){

        return "Inte påbörjad";

      }


      const plan =
        trainingPlanForDate(
          todayDate()
        );


      if(!plan){

        return "Vilodag";

      }


      const mode =
        p40Mode(
          row
        );


      const meta =
        p40Meta(
          row
        );


      if(
        mode === "recovery"
      ){

        return (
          `15K STEG ${p40FormatNumber(meta.steps)}/15 000`
        );

      }


      if(
        mode === "office"
      ){

        return (
          `${row.main_reps}/100`
          +
          " • "
          +
          `${formatSeconds(row.plank_seconds)}/5:00`
          +
          " • "
          +
          `WALL SIT ${formatSeconds(meta.office_seconds)}/2:00`
        );

      }


      if(
        mode === "shoulder"
      ){

        const techniqueDone =
          (
            row.bmu1_value >=
              plan.bmu1.target
            &&
            row.bmu2_value >=
              plan.bmu2.target
          );


        return (
          `${row.main_reps}/100`
          +
          " • "
          +
          `${formatSeconds(row.plank_seconds)}/5:00`
          +
          " • "
          +
          (
            techniqueDone
              ?
              "AXEL ✓"
              :
              "AXEL"
          )
        );

      }


      return baseTodayStatusText(
        row
      );

    };


  /* ========================================
     BMU BUTTON GUARD
     ======================================== */

  addBmu =
    async function(
      index,
      amount
    ){

      if(
        !todayProgress ||
        p40Mode(todayProgress) !==
          "normal"
      ){
        return;
      }


      await baseAddBmu(
        index,
        amount
      );

    };


  /* ========================================
     SAFE PLANK RENDER
     Handles metadata objects in plank_sets.
     ======================================== */

  renderPlank =
    function(){

      if(!todayProgress){
        return;
      }


      const mode =
        p40Mode(
          todayProgress
        );


      const total =
        displayedPlankSeconds();


      const plankName =
        document.getElementById(
          "plankName"
        );


      const timerSub =
        document.getElementById(
          "timerSub"
        );


      if(plankName){

        plankName.textContent =
          mode === "shoulder"
            ?
            "GLUTE BRIDGE HOLD"
            :
            "PLANKA";

      }


      if(timerSub){

        timerSub.textContent =
          mode === "shoulder"
            ?
            "5:00 totalt • dela upp i set • ingen axelbelastning"
            :
            "5:00 totalt • dela upp i set om du vill";

      }


      document
        .getElementById(
          "timerDisplay"
        )
        .textContent =
          formatSeconds(
            total
          );


      document
        .getElementById(
          "plankBadge"
        )
        .textContent =
          `${formatSeconds(total)} / 5:00`;


      toggleDone(
        "plankCard",
        "plankBadge",
        total >= 300
      );


      const active =
        activePlank();


      const button =
        document.getElementById(
          "timerButton"
        );


      if(
        total >= 300
      ){

        button.textContent =
          "✓ KLAR";

        button.disabled =
          true;

        button.className =
          "btn green";

      }

      else if(active){

        button.textContent =
          "■ STOPPA";

        button.disabled =
          false;

        button.className =
          "btn red";

      }

      else{

        button.textContent =
          "▶ STARTA";

        button.disabled =
          false;

        button.className =
          "btn primary";

      }


      const sets =
        p40NumericPlankSets(
          todayProgress
        );


      document
        .getElementById(
          "undoButton"
        )
        .disabled =
          !!active ||
          sets.length === 0;


      document
        .getElementById(
          "plankSets"
        )
        .textContent =
          sets.length
            ?
            "SET: "
            +
            sets
              .map(
                formatSeconds
              )
              .join(
                " + "
              )
            :
            "Inga set registrerade ännu.";

    };


  /* ========================================
     SAFE UNDO PLANK
     ======================================== */

  undoPlank =
    async function(){

      if(
        !todayProgress ||
        activePlank()
      ){
        return;
      }


      const array =
        Array.isArray(
          todayProgress.plank_sets
        )
          ?
          [
            ...todayProgress.plank_sets
          ]
          :
          [];


      let index =
        -1;


      for(
        let i =
          array.length - 1;
        i >= 0;
        i--
      ){

        if(
          typeof array[i] === "number"
        ){

          index =
            i;

          break;

        }

      }


      if(
        index === -1
      ){
        return;
      }


      const last =
        array[index];


      array.splice(
        index,
        1
      );


      todayProgress.plank_sets =
        array;


      todayProgress.plank_seconds =
        Math.max(
          0,
          todayProgress.plank_seconds -
            last
        );


      await saveToday();

    };


  /* ========================================
     UI RENDER
     ======================================== */

  function p40RenderExtraUI(){

    p40EnsureUI();


    if(!todayProgress){
      return;
    }


    const taskArea =
      document.getElementById(
        "taskArea"
      );


    if(
      !taskArea ||
      taskArea.classList.contains(
        "hidden"
      )
    ){
      return;
    }


    const mode =
      p40Mode(
        todayProgress
      );


    const meta =
      p40Meta(
        todayProgress
      );


    const labels = {

      normal:
        "NORMAL",

      shoulder:
        "AXEL",

      office:
        "KONTOR",

      recovery:
        "15K STEG"

    };


    const descriptions = {

      normal:
        "Dagens vanliga PROJECT 40-dos.",

      shoulder:
        "Axelvänlig dag. Huvuduppgiften skalas vid behov, plankan ersätts av glute bridge hold och provocerande teknikarbete hoppas över.",

      office:
        "Ingen stång eller ringar. Huvuduppgift + 5:00 planka som vanligt. Teknikdelen ersätts av 2:00 wall sit.",

      recovery:
        "Skadad eller rejält sliten. Hela dagens PROJECT 40 ersätts av 15 000 smärtfria steg."

    };


    document
      .getElementById(
        "p40ModeBadge"
      )
      .textContent =
        labels[mode];


    document
      .getElementById(
        "p40ModeInfo"
      )
      .textContent =
        descriptions[mode];


    document
      .querySelectorAll(
        ".p40-mode-button"
      )
      .forEach(
        button=>{

          button.classList.toggle(
            "active",
            button.dataset.p40Mode ===
              mode
          );

        }
      );


    /*
      Det gamla separata axelkortet
      ersätts av mode-selectorn.
    */

    const oldShoulder =
      document.getElementById(
        "shoulderToggleCard"
      );


    if(oldShoulder){

      oldShoulder.classList.add(
        "hidden"
      );

    }


    const mainCard =
      document.getElementById(
        "mainCard"
      );

    const plankCard =
      document.getElementById(
        "plankCard"
      );

    const bmu1Card =
      document.getElementById(
        "bmu1Card"
      );

    const bmu2Card =
      document.getElementById(
        "bmu2Card"
      );

    const shoulderTechnique =
      document.getElementById(
        "shoulderTechniqueCard"
      );

    const officeCard =
      document.getElementById(
        "p40OfficeCard"
      );

    const recoveryCard =
      document.getElementById(
        "p40RecoveryCard"
      );


    /*
      RECOVERY
    */

    if(
      mode === "recovery"
    ){

      mainCard?.classList.add(
        "hidden"
      );

      plankCard?.classList.add(
        "hidden"
      );

      bmu1Card?.classList.add(
        "hidden"
      );

      bmu2Card?.classList.add(
        "hidden"
      );

      shoulderTechnique?.classList.add(
        "hidden"
      );

      officeCard?.classList.add(
        "hidden"
      );

      recoveryCard?.classList.remove(
        "hidden"
      );


      p40RenderRecovery(
        meta
      );


      return;

    }


    mainCard?.classList.remove(
      "hidden"
    );

    plankCard?.classList.remove(
      "hidden"
    );


    recoveryCard?.classList.add(
      "hidden"
    );


    /*
      OFFICE
    */

    if(
      mode === "office"
    ){

      bmu1Card?.classList.add(
        "hidden"
      );

      bmu2Card?.classList.add(
        "hidden"
      );

      shoulderTechnique?.classList.add(
        "hidden"
      );

      officeCard?.classList.remove(
        "hidden"
      );


      p40RenderOffice(
        meta
      );


      return;

    }


    officeCard?.classList.add(
      "hidden"
    );


    /*
      SHOULDER
    */

    if(
      mode === "shoulder"
    ){

      bmu1Card?.classList.add(
        "hidden"
      );

      bmu2Card?.classList.add(
        "hidden"
      );


      /*
        baseRenderDay visar redan
        shoulderTechniqueCard när
        shoulder state är aktiv.
      */

      return;

    }


    /*
      NORMAL
    */

    bmu1Card?.classList.remove(
      "hidden"
    );

    bmu2Card?.classList.remove(
      "hidden"
    );

    shoulderTechnique?.classList.add(
      "hidden"
    );

  }


  function p40RenderOffice(meta){

    const done =
      meta.office_seconds >=
      120;


    document
      .getElementById(
        "p40OfficeNumber"
      )
      .textContent =
        formatSeconds(
          meta.office_seconds
        );


    document
      .getElementById(
        "p40OfficeBadge"
      )
      .textContent =
        `${formatSeconds(meta.office_seconds)} / 2:00`;


    document
      .getElementById(
        "p40OfficeCard"
      )
      .classList
      .toggle(
        "done",
        done
      );


    document
      .getElementById(
        "p40OfficeBadge"
      )
      .classList
      .toggle(
        "done",
        done
      );


    document
      .querySelectorAll(
        "#p40OfficeCard .p40-office-buttons button"
      )
      .forEach(
        button=>{

          button.disabled =
            done;

        }
      );

  }


  function p40RenderRecovery(meta){

    const done =
      meta.steps >=
      15000;


    document
      .getElementById(
        "p40StepsNumber"
      )
      .textContent =
        p40FormatNumber(
          meta.steps
        );


    document
      .getElementById(
        "p40StepsBadge"
      )
      .textContent =
        `${p40FormatNumber(meta.steps)} / 15 000`;


    document
      .getElementById(
        "p40RecoveryCard"
      )
      .classList
      .toggle(
        "done",
        done
      );


    document
      .getElementById(
        "p40StepsBadge"
      )
      .classList
      .toggle(
        "done",
        done
      );

  }


  /* ========================================
     OVERRIDE RENDER DAY
     ======================================== */

  renderDay =
    function(){

      /*
        Synka gamla shoulder-state med
        nya mode-metadata.
      */

      if(todayProgress){

        const meta =
          p40Meta(
            todayProgress
          );


        const shoulder =
          getShoulderState();


        if(
          meta.mode === "shoulder" &&
          !shoulder.enabled
        ){

          const plan =
            trainingPlanForDate(
              todayDate()
            );


          const completed =
            !!plan &&
            todayProgress.bmu1_value >=
              plan.bmu1.target &&
            todayProgress.bmu2_value >=
              plan.bmu2.target;


          saveShoulderState({
            enabled:true,
            bmuWaived:completed
          });

        }


        if(
          (
            meta.mode === "office" ||
            meta.mode === "recovery"
          )
          &&
          shoulder.enabled
        ){

          saveShoulderState({
            enabled:false,
            bmuWaived:false
          });

        }

      }


      baseRenderDay();


      p40RenderExtraUI();

    };


  /* ========================================
     SHARE
     ======================================== */

  shareStatus =
    async function(){

      if(!todayProgress){
        return;
      }


      const plan =
        trainingPlanForDate(
          todayDate()
        );


      if(!plan){
        return;
      }


      const mode =
        p40Mode(
          todayProgress
        );


      const meta =
        p40Meta(
          todayProgress
        );


      const complete =
        progressComplete(
          todayProgress,
          todayDate()
        );


      if(
        mode === "recovery"
      ){

        const text =
`🦍 PROJECT 40 — DAG ${plan.dayNumber}
${profile.display_name}

❤️‍🩹 SKADAD / SLITEN
15 000 STEG: ${p40FormatNumber(meta.steps)}/15 000 ${meta.steps >= 15000 ? "✅" : ""}

${complete ? "🦍 DAGEN KLAR!" : "⏳ PÅGÅR"}`;


        await shareText(
          "PROJECT 40",
          text
        );


        return;

      }


      if(
        mode === "office"
      ){

        const main =
          displayedMainTask(
            plan
          );


        const text =
`🦍 PROJECT 40 — DAG ${plan.dayNumber}
${profile.display_name}

${main.name}: ${todayProgress.main_reps}/100 ${todayProgress.main_reps >= 100 ? "✅" : ""}
PLANKA: ${formatSeconds(todayProgress.plank_seconds)}/5:00 ${todayProgress.plank_seconds >= 300 ? "✅" : ""}
🏢 WALL SIT: ${formatSeconds(meta.office_seconds)}/2:00 ${meta.office_seconds >= 120 ? "✅" : ""}

${complete ? "🦍 DAGEN KLAR!" : "⏳ PÅGÅR"}`;


        await shareText(
          "PROJECT 40",
          text
        );


        return;

      }


      await baseShareStatus();

    };


  /*
    iPhone / share fallback.
  */

  shareText =
    async function(
      title,
      text
    ){

      if(
        navigator.share
      ){

        try{

          await navigator.share({
            title,
            text
          });


          return;

        }catch(error){


          if(
            error?.name ===
            "AbortError"
          ){

            return;

          }


          console.error(
            "Share error:",
            error
          );

        }

      }


      await copyText(
        text
      );


      toast(
        "Texten kopierad ✓"
      );

    };


  /* ========================================
     RESET
     ======================================== */

  resetToday =
    async function(){

      await baseResetToday();


      /*
        Om reset lyckades är dagens nya
        progress tom. Vi återställer då
        även mode till NORMAL.
      */

      if(todayProgress){

        p40SetMeta(
          todayProgress,
          {
            mode:"normal",
            office_seconds:0,
            steps:0
          }
        );

      }


      saveShoulderState({
        enabled:false,
        bmuWaived:false
      });


      renderDay();

    };


  /* ========================================
     FORMAT
     ======================================== */

  function p40FormatNumber(value){

    return Math.max(
      0,
      Math.floor(
        Number(value) || 0
      )
    )
    .toLocaleString(
      "sv-SE"
    );

  }


  /* ========================================
     INITIALIZE
     ======================================== */

  p40EnsureUI();


  /*
    boot() kan fortfarande hålla på när
    add-on-filen läses in.
  */

  setTimeout(
    ()=>{

      try{

        if(
          typeof challenge !== "undefined" &&
          challenge
        ){

          renderDay();

        }

      }catch(error){

        console.error(
          "PROJECT 40 modes init:",
          error
        );

      }

    },
    500
  );


})();
