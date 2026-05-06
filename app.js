async function submitContactForm() {
  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const message = document.getElementById("contactMessage").value.trim();

  if (!name || !email || !message) {
    showMessage("Please complete all fields before submitting.");
    return;
  }

  try {
    await db.collection("contactMessages").add({
      name: name,
      email: email,
      inquiry: message,
      status: "Unread",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showMessage("Thank you! Your inquiry has been sent.");

    document.getElementById("contactName").value = "";
    document.getElementById("contactEmail").value = "";
    document.getElementById("contactMessage").value = "";

    showScreen("splash");

  } catch (error) {
    console.error("Contact form error:", error);
    showMessage("Inquiry failed to send. Please check Firebase Firestore Rules.");
  }
}

function showMessage(message) {
  const box = document.getElementById("systemMessage");
  if (!box) return;

  box.innerText = message;
  box.style.display = "block";

  setTimeout(function() {
    box.style.display = "none";
  }, 4000);
}

function showLoadingMessage(message) {
  const box = document.getElementById("systemMessage");
  if (!box) return;

  box.innerText = message;
  box.style.display = "block";
}

function hideMessage() {
  const box = document.getElementById("systemMessage");
  if (!box) return;

  box.style.display = "none";
}
    
    /* =====================================================
       PUPASS COMPLETE SINGLE-FILE SYSTEM
       - Student login with campus
       - One active booking per student
       - Sequential queue numbers by office/date
       - Oldest booking first
       - Admin campus + office filter
       - Technical reports
       - Requirements + Announcements
       - Dashboard queue monitor
    ===================================================== */

    const ADMIN_REGISTRATION_CODE = "PUPASS2026";
    const DAILY_BOOKING_LIMIT = 10;
    const ACTIVE_BOOKING_STATUSES = ["Waiting", "Serving", "Upcoming", "Now Serving"];

    /*
      Booking blackout dates.
      This blocks weekends and official Philippine regular / special non-working holidays.

      2026 holidays are based on Proclamation No. 1006.
      Eid'l Fitr is included based on Proclamation No. 1189.
      Add Eid'l Adha here after the official proclamation/date is released.
    */
    const PHILIPPINE_HOLIDAYS = {
      "2026-01-01": "New Year's Day",
      "2026-02-17": "Chinese New Year",
      "2026-03-20": "Eid'l Fitr",
      "2026-04-02": "Maundy Thursday",
      "2026-04-03": "Good Friday",
      "2026-04-04": "Black Saturday",
      "2026-04-09": "Araw ng Kagitingan",
      "2026-05-01": "Labor Day",
      "2026-06-12": "Independence Day",
      "2026-08-21": "Ninoy Aquino Day",
      "2026-08-31": "National Heroes Day",
      "2026-11-01": "All Saints' Day",
      "2026-11-02": "All Souls' Day",
      "2026-11-30": "Bonifacio Day",
      "2026-12-08": "Feast of the Immaculate Conception of Mary",
      "2026-12-24": "Christmas Eve",
      "2026-12-25": "Christmas Day",
      "2026-12-30": "Rizal Day",
      "2026-12-31": "Last Day of the Year"
    };

    const ADMIN_CAMPUSES = [
      "All",
      "PUP Main / Sta. Mesa",
      "PUP Taguig",
      "PUP San Juan",
      "PUP Parañaque",
      "PUP Quezon City",
      "PUP Bataan",
      "PUP Sta. Maria",
      "PUP Other Campus / Branch"
    ];

    const ADMIN_OFFICES = [
      "All",
      "Registrar",
      "Cashier",
      "Library",
      "Guidance",
      "Student Affairs",
      "Scholarship"
    ];

    const services = {
      registrar: {
        office: "Registrar Office",
        shortOffice: "Registrar",
        description: "Document request and enrollment-related concerns.",
        requests: ["Certificate of Registration", "Transcript of Records", "Enrollment Concern", "Document Request"]
      },
      cashier: {
        office: "Cashier Office",
        shortOffice: "Cashier",
        description: "Payment, assessment, receipt, and student account concerns.",
        requests: ["Tuition Payment Concern", "Assessment Inquiry", "Receipt Request", "Balance Verification"]
      },
      library: {
        office: "Library",
        shortOffice: "Library",
        description: "Clearance, borrowing, returning, and library account concerns.",
        requests: ["Library Clearance", "Borrowing Concern", "Returning Concern", "Library Account Verification"]
      },
      guidance: {
        office: "Guidance Office",
        shortOffice: "Guidance",
        description: "Counseling, student support, and guidance appointments.",
        requests: ["Counseling Appointment", "Student Support Request", "Good Moral Request", "Academic Concern"]
      },
      studentAffairs: {
        office: "Student Affairs Office",
        shortOffice: "Student Affairs",
        description: "Student ID concerns, student activities, and assistance.",
        requests: ["Student ID Concern", "Student Activity Inquiry", "Organization Concern", "Student Assistance Request"]
      },
      scholarship: {
        office: "Scholarship Office",
        shortOffice: "Scholarship",
        description: "Scholarship application, renewal, and inquiry.",
        requests: ["Scholarship Application", "Scholarship Renewal", "Scholarship Requirement Inquiry", "Grant Status Follow-up"]
      }
    };

    let selectedServiceKey = "registrar";

    let verifiedStudent = {
      studentId: "",
      fullName: "",
      campus: ""
    };

function saveStudentSession() {
  localStorage.setItem("pupass_student", JSON.stringify({
    verifiedStudent: verifiedStudent,
    currentAppointmentId: currentAppointmentId,
    currentAppointment: currentAppointment
  }));
}

function restoreStudentSession() {
  const savedSession = localStorage.getItem("pupass_student");

  if (!savedSession) return;

  const session = JSON.parse(savedSession);

  verifiedStudent = session.verifiedStudent || verifiedStudent;
  currentAppointmentId = session.currentAppointmentId || "";
  currentAppointment = session.currentAppointment || currentAppointment;

  updateStudentHeader();
  updatePassDetails();

  if (currentAppointmentId) {
    listenToStudentAppointment(currentAppointmentId);
  }

  showScreen("dashboard");
}

function clearStudentSession() {
  localStorage.removeItem("pupass_student");
}

function studentLogout() {
  clearStudentSession();

  verifiedStudent = {
    studentId: "",
    fullName: "",
    campus: ""
  };

  clearCurrentAppointment();

  if (studentAppointmentUnsubscribe) {
    studentAppointmentUnsubscribe();
    studentAppointmentUnsubscribe = null;
  }

  showScreen("splash");
}

    let currentAppointmentId = "";
    let currentAppointment = {
      exists: false,
      status: "None",
      queue: "",
      office: "",
      request: "",
      date: "",
      appointmentDateKey: "",
      time: "",
      purpose: ""
    };

    let studentAppointmentUnsubscribe = null;
    let adminFirestoreUnsubscribe = null;
    let technicalReportsUnsubscribe = null;
    let dashboardOfficeQueueRefreshTimer = null;

    let selectedAdminCampusFilter =
      localStorage.getItem("pupass_admin_campus_filter") || "PUP Main / Sta. Mesa";

    let selectedAdminOfficeFilter =
      localStorage.getItem("pupass_admin_office_filter") || "Registrar";

    let adminQueueView =
      localStorage.getItem("pupass_admin_queue_view") || "active";

    let adminTechnicalReportView = "open";
    let adminTechnicalReportSearch = "";

    function showScreen(screenId) {
      const screens = document.querySelectorAll(".screen");

      screens.forEach(function(screen) {
        screen.classList.remove("active");
      });

      const selectedScreen = document.getElementById(screenId);

      if (selectedScreen) {
        selectedScreen.classList.add("active");
      }

      window.scrollTo(0, 0);

      if (screenId === "pass") {
        setTimeout(renderQRCode, 100);
      }

      if (screenId === "dashboard") {
        setTimeout(function() {
          loadDashboardOfficeQueueMonitor();
          startDashboardOfficeQueueAutoRefresh();
        }, 200);
      } else {
        stopDashboardOfficeQueueAutoRefresh();
      }
    }

    function getText(id) {
      const element = document.getElementById(id);
      return element ? element.innerText.trim() : "";
    }

    function safePupassText(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function normalizeStudentId(studentId) {
      return String(studentId || "").trim().toUpperCase();
    }

    function normalizeAdminCampusName(campus) {
      return String(campus || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
    }

    function normalizeAdminOfficeName(office) {
      const value = String(office || "").toLowerCase();

      if (value.includes("registrar")) return "Registrar";
      if (value.includes("cashier")) return "Cashier";
      if (value.includes("library")) return "Library";
      if (value.includes("guidance")) return "Guidance";
      if (value.includes("student affairs")) return "Student Affairs";
      if (value.includes("scholarship")) return "Scholarship";

      return office || "Unknown";
    }

    function adminCampusMatches(campus) {
      if (!selectedAdminCampusFilter || selectedAdminCampusFilter === "All") {
        return true;
      }

      return normalizeAdminCampusName(campus) ===
        normalizeAdminCampusName(selectedAdminCampusFilter);
    }

    function adminOfficeMatches(office) {
      if (selectedAdminOfficeFilter === "All") {
        return true;
      }

      return normalizeAdminOfficeName(office) === selectedAdminOfficeFilter;
    }

    function isActiveBooking(status) {
      return ACTIVE_BOOKING_STATUSES.includes(status);
    }

    function getStatusClass(status) {
      if (status === "Serving" || status === "Now Serving") return "status-serving";
      if (status === "Completed") return "status-completed";
      if (status === "Cancelled" || status === "No-show") return "status-cancelled";
      return "status-waiting";
    }

    function getTodayDateKey() {
      const today = new Date();
      const timezoneOffset = today.getTimezoneOffset() * 60000;
      const localDate = new Date(today.getTime() - timezoneOffset);
      return localDate.toISOString().split("T")[0];
    }

    function formatDateForDisplay(dateKey) {
      if (!dateKey) return "";

      const parts = dateKey.split("-");
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const date = new Date(year, month, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }

    function getLocalDateFromKey(dateKey) {
      if (!dateKey) return null;

      const parts = dateKey.split("-");
      if (parts.length !== 3) return null;

      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);

      if (!year || month < 0 || month > 11 || !day) return null;

      return new Date(year, month, day);
    }

    function formatDateKeyFromLocalDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return year + "-" + month + "-" + day;
    }

    function isWeekendDateKey(dateKey) {
      const date = getLocalDateFromKey(dateKey);
      if (!date) return false;

      const day = date.getDay();
      return day === 0 || day === 6;
    }

    function getPhilippineHolidayName(dateKey) {
      return PHILIPPINE_HOLIDAYS[dateKey] || "";
    }

    function getUnavailableBookingReason(dateKey) {
      if (!dateKey) return "";

      const holidayName = getPhilippineHolidayName(dateKey);

      if (holidayName) {
        return "Bookings are not available on " + holidayName + ". Please choose another date.";
      }

      if (isWeekendDateKey(dateKey)) {
        return "Bookings are not available on weekends. Please choose a weekday.";
      }

      return "";
    }

    function getNextAvailableBookingDateKey(startDateKey) {
      let date = getLocalDateFromKey(startDateKey) || new Date();

      for (let i = 0; i < 400; i++) {
        const dateKey = formatDateKeyFromLocalDate(date);

        if (!getUnavailableBookingReason(dateKey)) {
          return dateKey;
        }

        date.setDate(date.getDate() + 1);
      }

      return startDateKey;
    }

    function updateAppointmentDateError(dateKey) {
      const appointmentDateInput = document.getElementById("appointmentDate");
      const appointmentDateError = document.getElementById("appointmentDateError");

      if (!appointmentDateInput || !appointmentDateError) return;

      const reason = getUnavailableBookingReason(dateKey);

      if (reason) {
        appointmentDateInput.classList.add("input-error");
        appointmentDateError.innerText = reason;
        appointmentDateError.style.display = "block";
        appointmentDateInput.setCustomValidity(reason);
      } else {
        appointmentDateInput.classList.remove("input-error");
        appointmentDateError.style.display = "none";
        appointmentDateInput.setCustomValidity("");
      }
    }

    function validateAppointmentDateSelection(showAlert) {
      const appointmentDateInput = document.getElementById("appointmentDate");

      if (!appointmentDateInput || !appointmentDateInput.value) return true;

      const reason = getUnavailableBookingReason(appointmentDateInput.value);

      updateAppointmentDateError(appointmentDateInput.value);

      if (reason) {
        if (showAlert) {
          showMessage(reason);
        }

        const nextAvailableDateKey = getNextAvailableBookingDateKey(appointmentDateInput.value);
        appointmentDateInput.value = nextAvailableDateKey;
        updateAppointmentDateError(nextAvailableDateKey);
        updateAppointmentSlotNote(nextAvailableDateKey);

        return false;
      }

      return true;
    }

    function formatPupassDateTime(value) {
      if (!value) return "Just now";

      try {
        const date = value.toDate ? value.toDate() : new Date(value);

        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
      } catch {
        return "Just now";
      }
    }

    function setupCalendarDefaults() {
      const todayKey = getTodayDateKey();
      const appointmentDateInput = document.getElementById("appointmentDate");

      if (appointmentDateInput) {
        appointmentDateInput.min = todayKey;

        if (!appointmentDateInput.value || getUnavailableBookingReason(appointmentDateInput.value)) {
          appointmentDateInput.value = getNextAvailableBookingDateKey(todayKey);
        }

        updateAppointmentDateError(appointmentDateInput.value);
        updateAppointmentSlotNote(appointmentDateInput.value);

        if (!appointmentDateInput.dataset.blackoutListenerAttached) {
          appointmentDateInput.addEventListener("change", function() {
            validateAppointmentDateSelection(true);
            updateAppointmentSlotNote(this.value);
          });

          appointmentDateInput.dataset.blackoutListenerAttached = "true";
        }
      }
    }

    function setStudentError(inputElement, errorElement, hasError) {
      if (!inputElement || !errorElement) return;

      if (hasError) {
        inputElement.classList.add("input-error");
        errorElement.style.display = "block";
      } else {
        inputElement.classList.remove("input-error");
        errorElement.style.display = "none";
      }
    }

    function ensureStudentLoggedIn() {
      if (!verifiedStudent.studentId || !verifiedStudent.fullName) {
        showScreen("studentLogin");
        return false;
      }

      return true;
    }

    function updateStudentHeader() {
      const greeting = document.getElementById("studentGreeting");
      const verifiedText = document.getElementById("verifiedStudentText");

      if (greeting) {
        greeting.innerText = "Hello, " + verifiedStudent.fullName + "!";
      }

      if (verifiedText) {
        verifiedText.innerText =
          verifiedStudent.studentId + " · " +
          verifiedStudent.fullName + " · " +
          verifiedStudent.campus;
      }

      const bookStudentId = document.getElementById("bookStudentId");
      const bookFullName = document.getElementById("bookFullName");
      const bookCampus = document.getElementById("bookCampus");

      if (bookStudentId) bookStudentId.innerText = verifiedStudent.studentId;
      if (bookFullName) bookFullName.innerText = verifiedStudent.fullName;
      if (bookCampus) bookCampus.innerText = verifiedStudent.campus;
    }

    function clearCurrentAppointment() {
      currentAppointmentId = "";

      currentAppointment = {
        exists: false,
        status: "None",
        queue: "",
        office: "",
        request: "",
        date: "",
        appointmentDateKey: "",
        time: "",
        purpose: ""
      };
    }

    function setCurrentAppointmentFromFirestore(appointmentId, item) {
      currentAppointmentId = appointmentId;

      currentAppointment.exists = true;
      currentAppointment.status = item.status || "Waiting";
      currentAppointment.queue = item.queueNumber || "";
      currentAppointment.office = item.office || "";
      currentAppointment.request = item.requestType || "";
      currentAppointment.date = item.appointmentDate || "";
      currentAppointment.appointmentDateKey = item.appointmentDateKey || "";
      currentAppointment.time = item.appointmentTime || "";
      currentAppointment.purpose = item.purpose || "";

      verifiedStudent.studentId = item.studentId || verifiedStudent.studentId;
      verifiedStudent.fullName = item.fullName || verifiedStudent.fullName;
      verifiedStudent.campus = item.campus || verifiedStudent.campus;

 updateStudentHeader();
updatePassDetails();
saveStudentSession();
}

async function getStudentAppointments(studentId, rawStudentId) {
      const studentKey = normalizeStudentId(studentId);
      const appointmentsMap = {};

      async function runQuery(fieldName, value) {
        if (!value) return;

        const snapshot = await db.collection("appointments")
          .where(fieldName, "==", value)
          .get();

        snapshot.forEach(function(doc) {
          appointmentsMap[doc.id] = {
            id: doc.id,
            data: doc.data()
          };
        });
      }

      await runQuery("studentKey", studentKey);
      await runQuery("studentId", studentKey);

      if (rawStudentId && rawStudentId !== studentKey) {
        await runQuery("studentId", rawStudentId);
      }

      const appointments = Object.values(appointmentsMap);

      appointments.sort(function(a, b) {
        const aTime = a.data.createdAt && a.data.createdAt.toMillis
          ? a.data.createdAt.toMillis()
          : 0;

        const bTime = b.data.createdAt && b.data.createdAt.toMillis
          ? b.data.createdAt.toMillis()
          : 0;

        return bTime - aTime;
      });

      return appointments;
    }

    async function getLatestStudentAppointment(studentId, rawStudentId) {
      const appointments = await getStudentAppointments(studentId, rawStudentId);

      const activeAppointment = appointments.find(function(item) {
        return isActiveBooking(item.data.status);
      });

      return activeAppointment || appointments[0] || null;
    }

    function listenToStudentAppointment(appointmentId) {
      if (studentAppointmentUnsubscribe) {
        studentAppointmentUnsubscribe();
      }

      studentAppointmentUnsubscribe = db.collection("appointments")
        .doc(appointmentId)
        .onSnapshot(function(doc) {
          if (!doc.exists) {
            clearCurrentAppointment();
            return;
          }

          setCurrentAppointmentFromFirestore(doc.id, doc.data());

          const activeScreen = document.querySelector(".screen.active");
          const activeScreenId = activeScreen ? activeScreen.id : "";

          if (activeScreenId === "appointment") {
            showAppointmentScreen();
          }

          if (activeScreenId === "queue") {
            showQueueFromNav();
          }

          if (activeScreenId === "dashboard") {
            loadDashboardOfficeQueueMonitor();
          }

          if (activeScreenId === "pass") {
            updatePassDetails();
          }
        });
    }

    async function studentLogin() {
      const studentIdInput = document.getElementById("studentIdInput");
      const fullNameInput = document.getElementById("fullNameInput");
      const campusInput = document.getElementById("campusInput");

      const studentIdError = document.getElementById("studentIdError");
      const fullNameError = document.getElementById("fullNameError");
      const campusError = document.getElementById("campusError");

      const rawStudentId = studentIdInput.value.trim();
      const studentId = normalizeStudentId(rawStudentId);
      const fullName = fullNameInput.value.trim();
      const campus = campusInput.value.trim();

      if (!studentId) {
        setStudentError(studentIdInput, studentIdError, true);
        return;
      }

      setStudentError(studentIdInput, studentIdError, false);

      try {
        const existingAppointment = await getLatestStudentAppointment(studentId, rawStudentId);

      if (existingAppointment) {
  const savedName = String(existingAppointment.data.fullName || "").trim().toLowerCase();
  const enteredName = String(fullName || "").trim().toLowerCase();

  if (!fullName) {
    fullNameError.innerText = "Full Name is required.";
    setStudentError(fullNameInput, fullNameError, true);
    return;
  }

  if (savedName && savedName !== enteredName) {
    fullNameError.innerText =
      "This Student ID Number is already registered under a different name. Please use your own student number or create a unique dummy student number.";
    setStudentError(fullNameInput, fullNameError, true);
    return;
  }

  setCurrentAppointmentFromFirestore(existingAppointment.id, existingAppointment.data);

  await db.collection("appointments").doc(existingAppointment.id).set({
    studentKey: studentId
  }, { merge: true });

  listenToStudentAppointment(existingAppointment.id);

  fullNameInput.value = verifiedStudent.fullName;
  campusInput.value = verifiedStudent.campus;

  setStudentError(fullNameInput, fullNameError, false);
  setStudentError(campusInput, campusError, false);

  showScreen("dashboard");
  return;
}

        let valid = true;

        if (!fullName) {
          setStudentError(fullNameInput, fullNameError, true);
          valid = false;
        } else {
          setStudentError(fullNameInput, fullNameError, false);
        }

        if (!campus) {
          setStudentError(campusInput, campusError, true);
          valid = false;
        } else {
          setStudentError(campusInput, campusError, false);
        }

        if (!valid) return;

      verifiedStudent.studentId = studentId;
verifiedStudent.fullName = fullName;
verifiedStudent.campus = campus;

clearCurrentAppointment();
updateStudentHeader();
saveStudentSession();

showScreen("dashboard");
      } catch (error) {
        console.error("Error checking student appointment:", error);
        showMessage("Could not check existing booking. Please check your internet connection or Firebase rules.");
      }
    }

    function goToServices() {
  if (!ensureStudentLoggedIn()) return;

  showScreen("services");
}

    function showRequirementsScreen() {
      if (!ensureStudentLoggedIn()) return;
      showScreen("requirements");
    }

    function showAnnouncementsScreen() {
      if (!ensureStudentLoggedIn()) return;
      showScreen("announcements");
    }

    function selectService(serviceKey) {
      if (!ensureStudentLoggedIn()) return;

      selectedServiceKey = serviceKey;
      const service = services[serviceKey];

      document.getElementById("selectedOffice").innerText = service.office;
      document.getElementById("selectedDescription").innerText = service.description;

      const requestSelect = document.getElementById("requestType");
      requestSelect.innerHTML = "";

      service.requests.forEach(function(request) {
        const option = document.createElement("option");
        option.textContent = request;
        option.value = request;
        requestSelect.appendChild(option);
      });

      updatePurpose();
      setupCalendarDefaults();
      showScreen("book");
    }

    function selectServiceDataOnly(serviceKey) {
      selectedServiceKey = serviceKey;
      const service = services[serviceKey];

      const requestSelect = document.getElementById("requestType");

      if (!requestSelect) return;

      requestSelect.innerHTML = "";

      service.requests.forEach(function(request) {
        const option = document.createElement("option");
        option.textContent = request;
        option.value = request;
        requestSelect.appendChild(option);
      });

      const selectedOffice = document.getElementById("selectedOffice");
      const selectedDescription = document.getElementById("selectedDescription");

      if (selectedOffice) selectedOffice.innerText = service.office;
      if (selectedDescription) selectedDescription.innerText = service.description;

      updatePurpose();
    }

    function updatePurpose() {
      const requestType = document.getElementById("requestType");
      const purposeText = document.getElementById("purposeText");

      if (!requestType || !purposeText) return;

      purposeText.value = "Request for " + requestType.value;
    }

    async function prepareConfirmation() {
      const service = services[selectedServiceKey];

      const requestType = document.getElementById("requestType").value;
      const dateKey = document.getElementById("appointmentDate").value;
      const time = document.getElementById("appointmentTime").value;
      const purpose = document.getElementById("purposeText").value.trim();

      if (!dateKey) {
        showMessage("Please select an appointment date.");
        return;
      }

      const unavailableReason = getUnavailableBookingReason(dateKey);

      if (unavailableReason) {
        updateAppointmentDateError(dateKey);
        await updateAppointmentSlotNote(dateKey);
        showMessage(unavailableReason);
        showScreen("book");
        return;
      }

      const bookedSlots = await countBookingsForDate(dateKey);

      if (bookedSlots >= DAILY_BOOKING_LIMIT) {
        await updateAppointmentSlotNote(dateKey);
        showMessage("Sorry, this date is already fully booked. Please choose another appointment date.");
        showScreen("book");
        return;
      }

      if (!purpose) {
        showMessage("Please enter your purpose of visit.");
        return;
      }

      const displayDate = formatDateForDisplay(dateKey);

      document.getElementById("confirmStudentId").innerText = verifiedStudent.studentId;
      document.getElementById("confirmFullName").innerText = verifiedStudent.fullName;
      document.getElementById("confirmCampus").innerText = verifiedStudent.campus;
      document.getElementById("confirmOffice").innerText = service.shortOffice;
      document.getElementById("confirmRequest").innerText = requestType;
      document.getElementById("confirmDate").innerText = displayDate;
      document.getElementById("confirmDate").dataset.dateKey = dateKey;
      document.getElementById("confirmTime").innerText = time;
      document.getElementById("confirmPurpose").innerText = purpose;

      showScreen("confirm");
    }

    async function countBookingsForDate(dateKey) {
      const displayDate = formatDateForDisplay(dateKey);
      const appointmentsMap = {};

      const snapshotByDateKey = await db.collection("appointments")
        .where("appointmentDateKey", "==", dateKey)
        .get();

      snapshotByDateKey.forEach(function(doc) {
        appointmentsMap[doc.id] = doc.data();
      });

      const snapshotByDisplayDate = await db.collection("appointments")
        .where("appointmentDate", "==", displayDate)
        .get();

      snapshotByDisplayDate.forEach(function(doc) {
        appointmentsMap[doc.id] = doc.data();
      });

      let count = 0;

      Object.values(appointmentsMap).forEach(function(item) {
        if (item.status !== "Cancelled") {
          count++;
        }
      });

      return count;
    }

    async function updateAppointmentSlotNote(dateKey) {
      const slotNote = document.getElementById("appointmentSlotNote");
      const slotText = document.getElementById("appointmentSlotText");

      if (!slotNote || !slotText) return;

      if (!dateKey) {
        slotNote.style.display = "none";
        return;
      }

      const unavailableReason = getUnavailableBookingReason(dateKey);

      if (unavailableReason) {
        slotNote.style.display = "block";
        slotText.innerHTML = "<b>Unavailable:</b> " + safePupassText(unavailableReason);
        return;
      }

      slotNote.style.display = "block";
      slotText.innerHTML = "Checking available slots...";

      try {
        const bookedSlots = await countBookingsForDate(dateKey);
        const remainingSlots = DAILY_BOOKING_LIMIT - bookedSlots;
        const displayDate = formatDateForDisplay(dateKey);

        if (remainingSlots <= 0) {
          slotText.innerHTML =
            "<b>No slots left.</b> " +
            safePupassText(displayDate) +
            " is already fully booked. Please choose another date.";
          return;
        }

        slotText.innerHTML =
          "<b>" + remainingSlots + " slot" + (remainingSlots === 1 ? "" : "s") + " left</b> for " +
          safePupassText(displayDate);
      } catch (error) {
        console.error("Error checking available slots:", error);

        slotText.innerHTML =
          "Could not check available slots right now. Please try again.";
      }
    }

    function getQueueOfficePrefix(office) {
      const value = String(office || "").toLowerCase();

      if (value.includes("registrar")) return "R";
      if (value.includes("cashier")) return "C";
      if (value.includes("library")) return "L";
      if (value.includes("guidance")) return "G";
      if (value.includes("student affairs")) return "S";
      if (value.includes("scholarship")) return "SCH";

      return "Q";
    }

    function getQueueOfficeKey(office) {
      return String(office || "General")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    function formatSequentialQueueNumber(office, number) {
      const prefix = getQueueOfficePrefix(office);
      return prefix + "-" + String(number).padStart(3, "0");
    }

    function getQueueCounterId(office, dateKey) {
      const officeKey = getQueueOfficeKey(office);
      return officeKey + "_" + dateKey;
    }

    async function createSequentialAppointment(newAppointment, office, appointmentDateKey) {
      const counterId = getQueueCounterId(office, appointmentDateKey);
      const counterRef = db.collection("queueCounters").doc(counterId);
      const appointmentRef = db.collection("appointments").doc();

      let finalAppointment = null;

      await db.runTransaction(async function(transaction) {
        const counterDoc = await transaction.get(counterRef);
        let lastNumber = 0;

        if (counterDoc.exists) {
          lastNumber = counterDoc.data().lastNumber || 0;
        }

        const nextNumber = lastNumber + 1;
        const queueNumber = formatSequentialQueueNumber(office, nextNumber);

        finalAppointment = {
          ...newAppointment,
          queueNumber: queueNumber,
          queueSequence: nextNumber,
          queueCounterId: counterId
        };

        transaction.set(counterRef, {
          office: office,
          officeKey: getQueueOfficeKey(office),
          appointmentDateKey: appointmentDateKey,
          lastNumber: nextNumber,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(appointmentRef, finalAppointment);
      });

      return {
        appointmentId: appointmentRef.id,
        appointment: finalAppointment
      };
    }

    async function saveBookingToFirestore() {
      const studentId = normalizeStudentId(getText("confirmStudentId"));
      const fullName = getText("confirmFullName");
      const campus = getText("confirmCampus");
      const office = getText("confirmOffice");
      const requestType = getText("confirmRequest");

      const appointmentDateKey =
        document.getElementById("confirmDate").dataset.dateKey ||
        document.getElementById("appointmentDate").value;

      const appointmentDate = formatDateForDisplay(appointmentDateKey);
      const appointmentTime = getText("confirmTime");
      const purpose = getText("confirmPurpose");

      if (!studentId || !fullName || !campus || !office || !requestType || !appointmentDateKey || !appointmentTime || !purpose) {
        showMessage("Some appointment details are missing. Please review your booking again.");
        return;
      }

      const unavailableReason = getUnavailableBookingReason(appointmentDateKey);

      if (unavailableReason) {
        await updateAppointmentSlotNote(appointmentDateKey);
        showMessage(unavailableReason);
        showScreen("book");
        return;
      }

      try {
        const existingAppointment = await getLatestStudentAppointment(studentId, studentId);

        if (existingAppointment && isActiveBooking(existingAppointment.data.status)) {
          setCurrentAppointmentFromFirestore(existingAppointment.id, existingAppointment.data);
          listenToStudentAppointment(existingAppointment.id);

          showMessage("You already have an active booking. Showing your existing appointment instead.");
          showAppointmentScreen();
          return;
        }

        const bookingsToday = await countBookingsForDate(appointmentDateKey);

        if (bookingsToday >= DAILY_BOOKING_LIMIT) {
          await updateAppointmentSlotNote(appointmentDateKey);
          showMessage("Sorry, this date is already fully booked. Please choose another appointment date.");
          showScreen("book");
          return;
        }

        const newAppointment = {
          studentId: studentId,
          studentKey: studentId,
          fullName: fullName,
          campus: campus,
          office: office,
          requestType: requestType,
          appointmentDate: appointmentDate,
          appointmentDateKey: appointmentDateKey,
          appointmentTime: appointmentTime,
          purpose: purpose,
          status: "Waiting",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const result = await createSequentialAppointment(
          newAppointment,
          office,
          appointmentDateKey
        );

        setCurrentAppointmentFromFirestore(result.appointmentId, result.appointment);
        listenToStudentAppointment(result.appointmentId);

        updatePassDetails();
        showScreen("pass");
      } catch (error) {
     console.error("Error saving booking with sequential queue:", error);
     showMessage("Booking was not saved. Please check your connection and try again.");
      }
    }

    function updatePassDetails() {
      const passQueue = document.getElementById("passQueue");
      const passStudentId = document.getElementById("passStudentId");
      const passFullName = document.getElementById("passFullName");
      const passCampus = document.getElementById("passCampus");
      const passOffice = document.getElementById("passOffice");
      const passRequest = document.getElementById("passRequest");
      const passDate = document.getElementById("passDate");
      const passTime = document.getElementById("passTime");
      const passStatus = document.getElementById("passStatus");

      if (passQueue) passQueue.innerText = currentAppointment.queue || "No Queue";
      if (passStudentId) passStudentId.innerText = verifiedStudent.studentId || "";
      if (passFullName) passFullName.innerText = verifiedStudent.fullName || "";
      if (passCampus) passCampus.innerText = verifiedStudent.campus || "";
      if (passOffice) passOffice.innerText = currentAppointment.office || "";
      if (passRequest) passRequest.innerText = currentAppointment.request || "";
      if (passDate) passDate.innerText = currentAppointment.date || "";
      if (passTime) passTime.innerText = currentAppointment.time || "";
      if (passStatus) passStatus.innerText = currentAppointment.status || "Waiting";

      renderQRCode();
    }

    function buildQRCodeText() {
      return JSON.stringify({
        appointmentId: currentAppointmentId || "",
        studentId: verifiedStudent.studentId || "",
        fullName: verifiedStudent.fullName || "",
        campus: verifiedStudent.campus || "",
        queueNumber: currentAppointment.queue || "",
        office: currentAppointment.office || "",
        request: currentAppointment.request || "",
        date: currentAppointment.date || "",
        time: currentAppointment.time || "",
        status: currentAppointment.status || ""
      });
    }

    function renderQRCode() {
      const qrContainer = document.getElementById("qrcode");
      if (!qrContainer) return;

      qrContainer.innerHTML = "";

      if (!currentAppointment.exists) {
        qrContainer.innerHTML = "<span style='font-size:12px;color:#666;'>No QR yet</span>";
        return;
      }

      if (typeof QRCode === "undefined") {
        qrContainer.innerHTML = "<span style='font-size:12px;color:#b00020;'>QR library not loaded</span>";
        return;
      }

      new QRCode(qrContainer, {
        text: buildQRCodeText(),
        width: 130,
        height: 130,
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    function printPass() {
      window.print();
    }

    function showAppointmentScreen() {
      if (!ensureStudentLoggedIn()) return;

      const content = document.getElementById("appointmentContent");

      if (!currentAppointment.exists) {
        content.innerHTML = `
          <div class="card gold-card">
            <h2>No Appointment Yet</h2>
            <p>No booking is currently linked to ${safePupassText(verifiedStudent.studentId)}.</p>
            <span class="status-pill">No Booking</span>
          </div>
          <button class="btn btn-gold" onclick="goToServices()">Book Appointment</button>
        `;

        showScreen("appointment");
        return;
      }

      let statusClass = getStatusClass(currentAppointment.status);
      let statusLabel = currentAppointment.status;

      if (currentAppointment.status === "Serving" || currentAppointment.status === "Now Serving") {
        statusLabel = "Now Serving";
      }

      if (currentAppointment.status === "Completed") {
        statusLabel = "Already Passed / Completed";
      }

      let actionButtons = "";

      if (isActiveBooking(currentAppointment.status)) {
        actionButtons = `
          <button class="btn" onclick="showScreen('pass')">View Queue Pass</button>
          <button class="btn btn-outline" onclick="showQueueFromNav()">View Queue Status</button>
          <button class="btn btn-outline" onclick="cancelAppointment()">Cancel Appointment</button>
        `;
      } else if (currentAppointment.status === "Completed") {
        actionButtons = `<button class="btn btn-outline" onclick="goToServices()">Book New Appointment</button>`;
      } else if (currentAppointment.status === "Cancelled") {
        actionButtons = `<button class="btn btn-gold" onclick="goToServices()">Book Again</button>`;
      }

      content.innerHTML = `
        <div class="card">
          <h2>Appointment Details</h2>

          <div class="detail-row">
            <span>Status</span>
            <span><span class="status-pill ${statusClass}">${safePupassText(statusLabel)}</span></span>
          </div>

          <div class="detail-row">
            <span>Queue Number</span>
            <span>${safePupassText(currentAppointment.queue)}</span>
          </div>

          <div class="detail-row">
            <span>Office</span>
            <span>${safePupassText(currentAppointment.office)}</span>
          </div>

          <div class="detail-row">
            <span>Request</span>
            <span>${safePupassText(currentAppointment.request)}</span>
          </div>

          <div class="detail-row">
            <span>Date</span>
            <span>${safePupassText(currentAppointment.date)}</span>
          </div>

          <div class="detail-row">
            <span>Time</span>
            <span>${safePupassText(currentAppointment.time)}</span>
          </div>
        </div>

        ${actionButtons}
      `;

      showScreen("appointment");
    }

    function getQueueSequenceValue(item) {
      if (item && item.queueSequence) {
        return Number(item.queueSequence);
      }

      const queueNumber = String(item && item.queueNumber ? item.queueNumber : "");
      const match = queueNumber.match(/(\d+)$/);

      if (match) {
        return Number(match[1]);
      }

      return 999999;
    }

    function isSameCurrentAppointmentDate(item) {
      if (!item) return false;

      if (currentAppointment.appointmentDateKey && item.appointmentDateKey) {
        return item.appointmentDateKey === currentAppointment.appointmentDateKey;
      }

      if (currentAppointment.date && item.appointmentDate) {
        return item.appointmentDate === currentAppointment.date;
      }

      return true;
    }

    async function getOfficeQueueSnapshot(officeName) {
      const snapshot = await db.collection("appointments")
        .where("office", "==", officeName)
        .get();

      const waitingList = [];
      const servingList = [];

      snapshot.forEach(function(doc) {
        const item = doc.data();
        item._id = doc.id;

        if (!isSameCurrentAppointmentDate(item)) return;

        if (item.status === "Serving" || item.status === "Now Serving") {
          servingList.push(item);
        }

        if (item.status === "Waiting") {
          waitingList.push(item);
        }
      });

      waitingList.sort(function(a, b) {
        return getQueueSequenceValue(a) - getQueueSequenceValue(b);
      });

      servingList.sort(function(a, b) {
        return getQueueSequenceValue(a) - getQueueSequenceValue(b);
      });

      return {
        waitingList: waitingList,
        servingList: servingList
      };
    }

    async function showQueueFromNav() {
      if (!ensureStudentLoggedIn()) return;
      showScreen("queue");

      const content = document.getElementById("queueContent");

      if (!currentAppointment.exists) {
        content.innerHTML = `
          <div class="card gold-card">
            <h2>No Queue Yet</h2>
            <p>No queue is currently linked to ${safePupassText(verifiedStudent.studentId)}.</p>
            <span class="status-pill">No Queue</span>
          </div>
          <button class="btn btn-gold" onclick="goToServices()">Book Appointment</button>
        `;

        return;
      }

      if (currentAppointment.status === "Cancelled") {
        content.innerHTML = `
          <div class="card">
            <h2>Queue Unavailable</h2>
            <p>Your appointment was cancelled. Please book a new appointment to get a new queue number.</p>
            <span class="status-pill status-cancelled">Cancelled</span>
          </div>
          <button class="btn btn-gold" onclick="goToServices()">Book New Appointment</button>
        `;

        showScreen("queue");
        return;
      }

      if (currentAppointment.status === "Completed") {
        content.innerHTML = `
          <div class="card">
            <h2>Appointment Already Completed</h2>
            <p>Your appointment has already been completed.</p>
            <span class="status-pill status-completed">Completed</span>
          </div>

          <div class="card">
            <div class="detail-row">
              <span>Queue Number</span>
              <span>${safePupassText(currentAppointment.queue)}</span>
            </div>
            <div class="detail-row">
              <span>Office</span>
              <span>${safePupassText(currentAppointment.office)}</span>
            </div>
            <div class="detail-row">
              <span>Date</span>
              <span>${safePupassText(currentAppointment.date)}</span>
            </div>
            <div class="detail-row">
              <span>Time</span>
              <span>${safePupassText(currentAppointment.time)}</span>
            </div>
          </div>

          <button class="btn btn-gold" onclick="goToServices()">Book New Appointment</button>
        `;

        showScreen("queue");
        return;
      }

     let currentServing = "None";
let nextInLine = "None";
let studentsAhead = "-";
let positionText = "-";
let estimatedWait = "-";

      try {
        const queueData = await getOfficeQueueSnapshot(currentAppointment.office);
        const waitingList = queueData.waitingList;
        const servingList = queueData.servingList;

        if (servingList.length) {
          currentServing = servingList[0].queueNumber || "None";
        }

        if (waitingList.length) {
          nextInLine = waitingList[0].queueNumber || "None";
        }

        const studentIndex = waitingList.findIndex(function(item) {
          return item._id === currentAppointmentId ||
            item.queueNumber === currentAppointment.queue ||
            normalizeStudentId(item.studentId) === normalizeStudentId(verifiedStudent.studentId);
        });

        if (studentIndex !== -1) {
  studentsAhead = String(studentIndex);
  positionText = String(studentIndex + 1);
  estimatedWait = String(studentIndex * 5) + " mins";
} else if (currentAppointment.status === "Serving" || currentAppointment.status === "Now Serving") {
  studentsAhead = "0";
  positionText = "Now Serving";
  estimatedWait = "0 mins";
}
      } catch (error) {
        console.error("Error loading queue status:", error);
      }

      const isServing =
        currentAppointment.status === "Serving" ||
        currentAppointment.status === "Now Serving";

      const servingLabel = isServing
        ? "You are now being served"
        : "Waiting";

      const servingClass = isServing
        ? "status-serving"
        : "status-waiting";

      content.innerHTML = `
        <div class="queue-grid">
          <div class="now-serving">
            <p>Current Serving</p>
            <strong>${safePupassText(currentServing)}</strong>
          </div>

          <div class="next-line-card">
            <p>Next in Line</p>
            <h1>${safePupassText(nextInLine)}</h1>
            <p>This is the next queue number to be called.</p>
          </div>

          <div class="card">
            <p>Your Queue Number</p>
            <h1 style="color:var(--maroon);font-size:44px;">${safePupassText(currentAppointment.queue)}</h1>
            <span class="status-pill ${servingClass}">${safePupassText(servingLabel)}</span>
          </div>
        </div>

        <div class="card gold-card">
          <div class="detail-row">
            <span>Office</span>
            <span>${safePupassText(currentAppointment.office)}</span>
          </div>
          <div class="detail-row">
            <span>Your Position</span>
            <span>${safePupassText(positionText)}</span>
          </div>
          <div class="detail-row">
            <span>Students Ahead</span>
            <span>${safePupassText(studentsAhead)}</span>
          </div>
          <div class="detail-row">
  <span>Estimated Wait</span>
  <span>${safePupassText(estimatedWait)}</span>
</div>
        </div>

        <div class="card">
          <h2>Progress</h2>

          <div class="step done">
            <div class="dot"></div>
            <span>Appointment Confirmed</span>
          </div>

          <div class="step ${!isServing ? "active" : "done"}">
            <div class="dot"></div>
            <span>Waiting</span>
          </div>

          <div class="step ${isServing ? "active" : ""}">
            <div class="dot"></div>
            <span>Now Serving</span>
          </div>

          <div class="step">
            <div class="dot"></div>
            <span>Completed</span>
          </div>
        </div>

        <button class="btn" onclick="showQueueFromNav()">Refresh Status</button>
      `;

      showScreen("queue");
    }

    async function cancelAppointment() {
      if (!currentAppointmentId) {
        showMessage("No appointment selected.");
        return;
      }

      const confirmCancel = confirm("Cancel this appointment?");
      if (!confirmCancel) return;

      try {
        await db.collection("appointments").doc(currentAppointmentId).update({
          status: "Cancelled",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("Appointment cancelled.");
      } catch (error) {
        console.error("Error cancelling appointment:", error);
        showMessage("Appointment was not cancelled.");
      }
    }

    async function completeAppointment() {
      if (!currentAppointmentId) {
        showScreen("thankYou");
        return;
      }

      try {
        await db.collection("appointments").doc(currentAppointmentId).update({
          status: "Completed",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showScreen("thankYou");
      } catch (error) {
        console.error("Error completing appointment:", error);
        showScreen("thankYou");
      }
    }

  function openFeedbackSurvey() {
  const feedbackFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfWcDZugsMhWRd3oLtIBXC4_b1TEFmcAYnymFRRnaUIIcK3Rw/viewform?usp=sharing&ouid=112133641462307009901";

  window.open(feedbackFormUrl, "_blank", "noopener,noreferrer");
}

    async function showNotificationsScreen() {
      if (!ensureStudentLoggedIn()) return;

      const content = document.getElementById("notificationsContent");

      content.innerHTML = `<div class="card"><p>Loading booking history...</p></div>`;
      showScreen("notifications");

      try {
        const appointments = await getStudentAppointments(
          verifiedStudent.studentId,
          verifiedStudent.studentId
        );

        const history = appointments.filter(function(item) {
          const status = item.data.status || "";
          return status === "Completed" || status === "Cancelled";
        });

        if (!history.length) {
          content.innerHTML = `
            <div class="card gold-card">
              <h2>No Booking History Yet</h2>
              <p>Completed and cancelled bookings will appear here.</p>
              <span class="status-pill">No History</span>
            </div>
          `;
          return;
        }

        content.innerHTML = history.map(function(item) {
          const booking = item.data;
          const status = booking.status || "";
          const statusClass = status === "Cancelled" ? "status-cancelled" : "status-completed";

          return `
            <div class="card">
              <h2>${safePupassText(booking.office || "Appointment")}</h2>

              <div class="detail-row">
                <span>Status</span>
                <span><span class="status-pill ${statusClass}">${safePupassText(status)}</span></span>
              </div>

              <div class="detail-row">
                <span>Queue Number</span>
                <span>${safePupassText(booking.queueNumber || "")}</span>
              </div>

              <div class="detail-row">
                <span>Request</span>
                <span>${safePupassText(booking.requestType || "")}</span>
              </div>

              <div class="detail-row">
                <span>Date</span>
                <span>${safePupassText(booking.appointmentDate || "")}</span>
              </div>

              <div class="detail-row">
                <span>Time</span>
                <span>${safePupassText(booking.appointmentTime || "")}</span>
              </div>
            </div>
          `;
        }).join("");
      } catch (error) {
        console.error("Error loading booking history:", error);

        content.innerHTML = `
          <div class="card">
            <h2>Could not load booking history</h2>
            <p>Please check Firebase rules or internet connection.</p>
          </div>
        `;
      }
    }

    function createTechnicalReportNumber() {
      const date = new Date();

      const datePart =
        date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0");

      const randomPart = Math.floor(Math.random() * 9000) + 1000;

      return "TECH-" + datePart + "-" + randomPart;
    }

    async function getStudentActiveTechnicalReport() {
      const snapshot = await db.collection("technicalReports")
        .where("studentId", "==", verifiedStudent.studentId)
        .get();

      let activeReport = null;

      snapshot.forEach(function(doc) {
        const item = doc.data();

        if (item.archived !== true && item.status !== "Closed" && item.status !== "Resolved") {
          activeReport = {
            id: doc.id,
            data: item
          };
        }
      });

      return activeReport;
    }

    function renderStudentTechnicalReportBox(report) {
      const box = document.getElementById("studentActiveTechnicalReportBox");
      if (!box) return;

      if (!report) {
        box.innerHTML = `
          <div class="card gold-card">
            <h2>No Active Technical Report</h2>
            <p>You may submit a new technical error report below.</p>
            <span class="status-pill">No Active Report</span>
          </div>
        `;
        return;
      }

      const item = report.data;
      const status = item.status || "Open";

      let statusClass = "status-waiting";
      if (status === "Investigating") statusClass = "status-serving";
      if (status === "Resolved") statusClass = "status-completed";

      box.innerHTML = `
        <div class="card gold-card">
          <h2>Active Technical Report</h2>

          <div class="detail-row">
            <span>Report Number</span>
            <span>${safePupassText(item.reportNumber || report.id)}</span>
          </div>

          <div class="detail-row">
            <span>Status</span>
            <span><span class="status-pill ${statusClass}">${safePupassText(status)}</span></span>
          </div>

          <div class="detail-row">
            <span>Error Area</span>
            <span>${safePupassText(item.errorArea || "")}</span>
          </div>

          <div class="detail-row">
            <span>Problem</span>
            <span>${safePupassText(item.description || "")}</span>
          </div>

          ${
            item.adminResponse
              ? `
                <div class="detail-row">
                  <span>Admin Response</span>
                  <span>${safePupassText(item.adminResponse)}</span>
                </div>
              `
              : ""
          }

          <p style="margin-top:12px;">
            You cannot create another technical report until this is resolved or closed by admin.
          </p>
        </div>
      `;
    }

    async function showHelpScreen() {
      if (!ensureStudentLoggedIn()) return;

      showScreen("help");

      try {
        const report = await getStudentActiveTechnicalReport();
        renderStudentTechnicalReportBox(report);
      } catch (error) {
        console.error("Error loading active technical report:", error);
      }
    }

    async function submitTechnicalErrorReport() {
      if (!ensureStudentLoggedIn()) return;

      const errorArea = document.getElementById("technicalErrorArea").value;
      const description = document.getElementById("technicalErrorDescription").value.trim();
      const steps = document.getElementById("technicalErrorSteps").value.trim();

      if (!description) {
        showMessage("Please describe the technical problem.");
        return;
      }

      if (!steps) {
        showMessage("Please describe the steps before the error happened.");
        return;
      }

      try {
        const activeReport = await getStudentActiveTechnicalReport();

        if (activeReport) {
          renderStudentTechnicalReportBox(activeReport);
          showMessage("You already have an active technical report. Please wait for admin to resolve or close it.");
          return;
        }

        const reportNumber = createTechnicalReportNumber();

        await db.collection("technicalReports").add({
          reportNumber: reportNumber,
          studentId: verifiedStudent.studentId,
          fullName: verifiedStudent.fullName,
          campus: verifiedStudent.campus,
          errorArea: errorArea,
          description: description,
          steps: steps,
          adminResponse: "",
          status: "Open",
          archived: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById("technicalErrorDescription").value = "";
        document.getElementById("technicalErrorSteps").value = "";

        showMessage("Technical report submitted. Report Number: " + reportNumber);

        const newReport = await getStudentActiveTechnicalReport();
        renderStudentTechnicalReportBox(newReport);
      } catch (error) {
        console.error("Error submitting technical report:", error);
        showMessage("Technical report was not submitted. Please check Firebase rules.");
      }
    }

    async function loadDashboardOfficeQueueMonitor() {
      const container = document.getElementById("dashboardQueueMonitor");
      if (!container) return;

      if (!currentAppointment.exists) {
        container.innerHTML = "";
        return;
      }

      let currentServing = "None";
      let nextInLine = "None";
      let studentsAhead = "-";
let positionText = "-";
let estimatedWait = "-";
let message = "";

      try {
        const queueData = await getOfficeQueueSnapshot(currentAppointment.office);
        const waitingList = queueData.waitingList;
        const servingList = queueData.servingList;

        if (servingList.length) {
          currentServing = servingList[0].queueNumber || "None";
        }

        if (waitingList.length) {
          nextInLine = waitingList[0].queueNumber || "None";
        }

        const studentIndex = waitingList.findIndex(function(item) {
          return item._id === currentAppointmentId ||
            item.queueNumber === currentAppointment.queue ||
            normalizeStudentId(item.studentId) === normalizeStudentId(verifiedStudent.studentId);
        });

        if (studentIndex !== -1) {
          studentsAhead = String(studentIndex);
          positionText = String(studentIndex + 1);
          estimatedWait = String(studentIndex * 5) + " mins";
          message = studentIndex === 0
            ? "You are next in line. Please be ready."
            : "Please wait for your queue number to be called.";
        } else if (currentAppointment.status === "Serving" || currentAppointment.status === "Now Serving") {
          studentsAhead = "0";
          positionText = "Now Serving";
          message = "You are now being served.";
        } else if (currentAppointment.status === "Completed") {
          positionText = "Completed";
          message = "Your appointment is completed.";
        } else if (currentAppointment.status === "Cancelled") {
          positionText = "Cancelled";
          message = "Your appointment was cancelled.";
        }
      } catch (error) {
        console.error("Error loading dashboard queue monitor:", error);
      }

      const statusClass = getStatusClass(currentAppointment.status);
      const statusText =
        currentAppointment.status === "Serving" || currentAppointment.status === "Now Serving"
          ? "Now Serving"
          : currentAppointment.status;

      container.innerHTML = `
        <div class="card" style="margin-top:22px;">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <h2>My Office Queue Monitor</h2>
              <p>Live queue status for ${safePupassText(currentAppointment.office)}.</p>
            </div>

            <button class="btn btn-small btn-outline" onclick="showQueueFromNav()">
              View Full Queue
            </button>
          </div>

          <div class="queue-grid" style="margin-top:16px;">
            <div class="now-serving">
              <p>Current Serving</p>
              <strong>${safePupassText(currentServing)}</strong>
            </div>

            <div class="next-line-card">
              <p>Next in Line</p>
              <h1>${safePupassText(nextInLine)}</h1>
              <p>Waiting queue for your office.</p>
            </div>

            <div class="card" style="margin-bottom:0;">
              <p>Your Queue Number</p>
              <h1 style="color:var(--maroon);font-size:44px;margin:6px 0;">${safePupassText(currentAppointment.queue)}</h1>
              <span class="status-pill ${statusClass}">${safePupassText(statusText)}</span>
            </div>
          </div>

          <div class="card gold-card" style="margin-top:16px;margin-bottom:0;">
            <div class="detail-row">
              <span>Booked Office</span>
              <span>${safePupassText(currentAppointment.office)}</span>
            </div>

            <div class="detail-row">
              <span>Appointment Date</span>
              <span>${safePupassText(currentAppointment.date)}</span>
            </div>

            <div class="detail-row">
              <span>Your Position</span>
              <span>${safePupassText(positionText)}</span>
            </div>

            <div class="detail-row">
              <span>Students Ahead</span>
              <span>${safePupassText(studentsAhead)}</span>
            </div>

            <div class="detail-row">
  <span>Estimated Wait</span>
  <span>${safePupassText(estimatedWait)}</span>
</div>

            <p style="margin-top:12px;font-weight:700;color:var(--maroon);">${safePupassText(message)}</p>
          </div>
        </div>
      `;
    }

    function startDashboardOfficeQueueAutoRefresh() {
      stopDashboardOfficeQueueAutoRefresh();

      dashboardOfficeQueueRefreshTimer = setInterval(function() {
        const activeScreen = document.querySelector(".screen.active");
        const activeScreenId = activeScreen ? activeScreen.id : "";

        if (activeScreenId === "dashboard") {
          loadDashboardOfficeQueueMonitor();
        }
      }, 15000);
    }

    function stopDashboardOfficeQueueAutoRefresh() {
      if (dashboardOfficeQueueRefreshTimer) {
        clearInterval(dashboardOfficeQueueRefreshTimer);
        dashboardOfficeQueueRefreshTimer = null;
      }
    }

    function showAdminCreateForm() {
      const form = document.getElementById("adminCreateForm");

      if (!form) return;

      form.style.display = form.style.display === "none" ? "block" : "none";
    }

    async function adminLogin() {
      const email = document.getElementById("adminEmail").value.trim();
      const password = document.getElementById("adminPassword").value;

      if (!email || !password) {
        showMessage("Please enter admin email and password.");
        return;
      }

      try {
        await auth.signInWithEmailAndPassword(email, password);
        openAdminDashboard();
      } catch (error) {
        console.error("Admin login error:", error);
        showMessage("Invalid admin email or password.");
      }
    }

  window.resetAdminPassword = async function () {
  const emailInput = document.getElementById("adminEmail");

  if (!emailInput) {
    alert("Admin email field not found.");
    return;
  }

  const email = emailInput.value.trim();

  if (!email) {
    alert("Please enter your admin email first.");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    showMessage("Password reset email sent. Please check your inbox or spam folder.");
  } catch (error) {
    console.error("Password reset error:", error);
    alert(error.message || "Could not send password reset email.");
  }
};

    async function createAdminAccount() {
      const email = document.getElementById("newAdminEmail").value.trim();
      const password = document.getElementById("newAdminPassword").value;
      const registrationCode = document.getElementById("adminRegistrationCode").value.trim();

      if (!email || !password || !registrationCode) {
        showMessage("Please complete all admin account fields.");
        return;
      }

      if (registrationCode !== ADMIN_REGISTRATION_CODE) {
        showMessage("Invalid admin registration code.");
        return;
      }

      try {
        await auth.createUserWithEmailAndPassword(email, password);
        showMessage("Admin account created successfully. You are now logged in.");
        openAdminDashboard();
      } catch (error) {
        console.error("Create admin error:", error);
        showMessage("Admin account was not created. The email may already exist or the password may be too weak.");
      }
    }

    async function adminLogout() {
      if (adminFirestoreUnsubscribe) {
        adminFirestoreUnsubscribe();
        adminFirestoreUnsubscribe = null;
      }

      if (technicalReportsUnsubscribe) {
        technicalReportsUnsubscribe();
        technicalReportsUnsubscribe = null;
      }

      await auth.signOut();
      showScreen("splash");
    }

    function openAdminDashboard() {
      showScreen("admin");
      ensureAdminFilterUI();
      renderAdminAppointments();
      renderAdminTechnicalReportInbox();
    }

function openAdminTechnicalReports() {
  showScreen("adminTechnicalReports");
  renderAdminTechnicalReportInbox();
}

    function ensureAdminFilterUI() {
      const area = document.getElementById("adminFilterArea");
      if (!area) return;

      area.innerHTML = `
        <div class="card">
          <h2>Filter by Campus / Site</h2>
          <p>Select the campus/site this admin is managing.</p>

          <select
            class="input-box"
            id="adminCampusFilterSelect"
            onchange="setAdminCampusFilter(this.value)"
            style="margin-top:12px;"
          >
            ${ADMIN_CAMPUSES.map(function(campus) {
              const selected = selectedAdminCampusFilter === campus ? "selected" : "";
              return `<option value="${safePupassText(campus)}" ${selected}>${safePupassText(campus)}</option>`;
            }).join("")}
          </select>

          <p style="margin-top:12px;font-weight:700;color:var(--maroon);">
            Currently showing campus/site: ${safePupassText(selectedAdminCampusFilter)}
          </p>
        </div>

      <div class="card">
  <h2>Filter by Office</h2>
  <p>Select which office queue you want to manage.</p>

  <select
    class="input-box admin-office-filter-dropdown"
    onchange="setAdminOfficeFilter(this.value)"
    style="margin-top:12px;"
  >
    ${ADMIN_OFFICES.map(function(office) {
      const selected = selectedAdminOfficeFilter === office ? "selected" : "";
      return `<option value="${safePupassText(office)}" ${selected}>${safePupassText(office)}</option>`;
    }).join("")}
  </select>

  <div class="admin-office-filter-buttons" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
    ${ADMIN_OFFICES.map(function(office) {
      const activeClass = selectedAdminOfficeFilter === office ? "btn-gold" : "btn-outline";
      return `
        <button class="btn btn-small ${activeClass}" onclick="setAdminOfficeFilter('${safePupassText(office)}')">
          ${safePupassText(office)}
        </button>
      `;
    }).join("")}
  </div>

  <p style="margin-top:12px;font-weight:700;color:var(--maroon);">
    Currently showing office: ${safePupassText(selectedAdminOfficeFilter)}
  </p>
</div>

        <div class="card">
          <h2>Queue View</h2>
          <p>Active Queue shows waiting and serving students. Archive shows completed, cancelled, and no-show records.</p>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
            <button class="btn btn-small ${adminQueueView === "active" ? "btn-gold" : "btn-outline"}" onclick="setAdminQueueView('active')">
              Active Queue
            </button>
            <button class="btn btn-small ${adminQueueView === "archive" ? "btn-gold" : "btn-outline"}" onclick="setAdminQueueView('archive')">
              Archive
            </button>
          </div>
        </div>
      `;
    }

    function setAdminCampusFilter(campus) {
      selectedAdminCampusFilter = campus;
      localStorage.setItem("pupass_admin_campus_filter", campus);
      ensureAdminFilterUI();
      renderAdminAppointments();
    }

    function setAdminOfficeFilter(office) {
      selectedAdminOfficeFilter = office;
      localStorage.setItem("pupass_admin_office_filter", office);
      ensureAdminFilterUI();
      renderAdminAppointments();
    }

    function setAdminQueueView(view) {
      adminQueueView = view;
      localStorage.setItem("pupass_admin_queue_view", view);
      ensureAdminFilterUI();
      renderAdminAppointments();
    }

    function isAdminArchiveStatus(status) {
      return status === "Completed" || status === "Cancelled" || status === "No-show";
    }

    function getAdminCreatedMillis(item) {
      if (!item) return 0;

      if (item.createdAt && item.createdAt.toMillis) {
        return item.createdAt.toMillis();
      }

      return 0;
    }

    function sortActiveAppointments(records) {
      records.sort(function(a, b) {
        const statusA = a.data.status || "Waiting";
        const statusB = b.data.status || "Waiting";

        const servingA = statusA === "Serving" || statusA === "Now Serving";
        const servingB = statusB === "Serving" || statusB === "Now Serving";

        if (servingA && !servingB) return -1;
        if (!servingA && servingB) return 1;

        const sequenceA = getQueueSequenceValue(a.data);
        const sequenceB = getQueueSequenceValue(b.data);

        if (sequenceA !== sequenceB) {
          return sequenceA - sequenceB;
        }

        return getAdminCreatedMillis(a.data) - getAdminCreatedMillis(b.data);
      });
    }

    function updateAdminQueueNumberStats(records) {
      const waitingLabel = document.getElementById("adminWaitingQueues");
      const servingLabel = document.getElementById("adminServingQueues");

      const waitingQueues = [];
      const servingQueues = [];

      records.forEach(function(record) {
        const item = record.data;
        const queue = item.queueNumber || "";
        const status = item.status || "Waiting";

        if (!queue) return;
        if (status === "Waiting") waitingQueues.push(queue);
        if (status === "Serving" || status === "Now Serving") servingQueues.push(queue);
      });

      function preview(queueList) {
        if (!queueList.length) return "None";
        if (queueList.length <= 3) return queueList.join(", ");
        return queueList.slice(0, 3).join(", ") + " +" + (queueList.length - 3) + " more";
      }

      if (waitingLabel) waitingLabel.innerText = "Next: " + preview(waitingQueues);
      if (servingLabel) servingLabel.innerText = "Now Serving: " + preview(servingQueues);
    }

    function renderAdminAppointments() {
      const list = document.getElementById("adminAppointmentList");
      if (!list) return;

      list.innerHTML = `<div class="card"><p>Loading appointments from Firebase...</p></div>`;

      if (adminFirestoreUnsubscribe) {
        adminFirestoreUnsubscribe();
      }

      adminFirestoreUnsubscribe = db.collection("appointments")
        .orderBy("createdAt", "asc")
        .onSnapshot(function(snapshot) {
          const allAppointments = [];

          snapshot.forEach(function(doc) {
            allAppointments.push({
              id: doc.id,
              data: doc.data()
            });
          });

          let filteredAppointments = allAppointments.filter(function(record) {
            return adminCampusMatches(record.data.campus) &&
              adminOfficeMatches(record.data.office);
          });

          if (adminQueueView === "active") {
            filteredAppointments = filteredAppointments.filter(function(record) {
              return !isAdminArchiveStatus(record.data.status || "Waiting");
            });

            sortActiveAppointments(filteredAppointments);
          } else {
            filteredAppointments = filteredAppointments.filter(function(record) {
              return isAdminArchiveStatus(record.data.status || "Waiting");
            });

            filteredAppointments.sort(function(a, b) {
              return getAdminCreatedMillis(a.data) - getAdminCreatedMillis(b.data);
            });
          }

          let total = 0;
          let waiting = 0;
          let serving = 0;
          let completed = 0;

          filteredAppointments.forEach(function(record) {
            const status = record.data.status || "Waiting";
            total++;
            if (status === "Waiting") waiting++;
            if (status === "Serving" || status === "Now Serving") serving++;
            if (status === "Completed") completed++;
          });

          document.getElementById("adminTotal").innerText = total;
          document.getElementById("adminWaiting").innerText = waiting;
          document.getElementById("adminServing").innerText = serving;
          document.getElementById("adminCompleted").innerText = completed;

          updateAdminQueueNumberStats(filteredAppointments);

          if (!filteredAppointments.length) {
            list.innerHTML = `
              <div class="card gold-card">
                <h2>No Appointments Found</h2>
                <p>No appointments found for ${safePupassText(selectedAdminCampusFilter)} and ${safePupassText(selectedAdminOfficeFilter)}.</p>
              </div>
            `;
            return;
          }

          list.innerHTML = "";

          filteredAppointments.forEach(function(record) {
            const item = record.data;
            const appointmentId = record.id;
            const status = item.status || "Waiting";

            const card = document.createElement("div");
            card.className = "list-item";

            let actionButtons = "";

            if (status === "Waiting") {
              actionButtons = `
                <button class="btn btn-small btn-blue" onclick="updateAdminStatus('${appointmentId}', 'Serving')">Now Serving</button>
                <button class="btn btn-small btn-green" onclick="updateAdminStatus('${appointmentId}', 'Completed')">Complete</button>
                <button class="btn btn-small btn-outline" onclick="updateAdminStatus('${appointmentId}', 'No-show')">No-show</button>
              `;
            } else if (status === "Serving" || status === "Now Serving") {
              actionButtons = `
                <button class="btn btn-small btn-green" onclick="updateAdminStatus('${appointmentId}', 'Completed')">Complete</button>
                <button class="btn btn-small btn-outline" onclick="updateAdminStatus('${appointmentId}', 'No-show')">No-show</button>
              `;
            } else if (status === "Completed") {
              actionButtons = `<button class="btn btn-small btn-outline" disabled>Completed</button>`;
            } else if (status === "Cancelled") {
              actionButtons = `<button class="btn btn-small btn-outline" disabled>Cancelled</button>`;
            } else {
              actionButtons = `<button class="btn btn-small btn-outline" disabled>${safePupassText(status)}</button>`;
            }

            card.innerHTML = `
              <strong>${safePupassText(item.queueNumber || "")}</strong>
              <p>${safePupassText(item.fullName || "")} · ${safePupassText(item.campus || "No campus")} · ${safePupassText(item.office || "")}</p>
              <p style="font-size:12px;">Student ID: ${safePupassText(item.studentId || "")}</p>
              <p style="font-size:12px;">Request: ${safePupassText(item.requestType || "")}</p>
              <p style="font-size:12px;">Date: ${safePupassText(item.appointmentDate || "")} · ${safePupassText(item.appointmentTime || "")}</p>
              <span class="status-pill ${getStatusClass(status)}">${safePupassText(status)}</span>
              <div class="admin-actions">${actionButtons}</div>
            `;

            list.appendChild(card);
          });
        }, function(error) {
          console.error("Error loading admin appointments:", error);

          list.innerHTML = `
            <div class="card">
              <h2>Could not load appointments</h2>
              <p>Please check your Firebase rules and internet connection.</p>
            </div>
          `;
        });
    }

    async function updateAdminStatus(appointmentId, newStatus) {
      try {
        await db.collection("appointments").doc(appointmentId).update({
          status: newStatus,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating appointment:", error);
        showMessage("Status was not updated.");
      }
    }

    function ensureAdminTechnicalReportControls() {
      const controls = document.getElementById("adminTechnicalReportControls");
      if (!controls) return;

      controls.innerHTML = `
        <div class="card">
          <h2>Report View</h2>
          <p>Open, investigating, and resolved reports appear in the main view. Closed reports go to Archive.</p>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
            <button id="adminTechOpenBtn" class="btn btn-small ${adminTechnicalReportView === "open" ? "btn-gold" : "btn-outline"}" onclick="setAdminTechnicalReportView('open')">Open Reports</button>
            <button id="adminTechArchiveBtn" class="btn btn-small ${adminTechnicalReportView === "archive" ? "btn-gold" : "btn-outline"}" onclick="setAdminTechnicalReportView('archive')">Archive</button>
          </div>

          <input
            class="input-box"
            id="adminTechnicalReportSearch"
            placeholder="Search report number, student name, student ID, error area..."
            style="margin-top:14px;"
            oninput="setAdminTechnicalReportSearch(this.value)"
            value="${safePupassText(adminTechnicalReportSearch)}"
          />
        </div>
      `;
    }

    function setAdminTechnicalReportView(view) {
      adminTechnicalReportView = view;
      ensureAdminTechnicalReportControls();
      renderAdminTechnicalReportInbox();
    }

    function setAdminTechnicalReportSearch(value) {
      adminTechnicalReportSearch = String(value || "").toLowerCase().trim();
      renderAdminTechnicalReportInbox();
    }

    function technicalReportMatchesSearch(item) {
      if (!adminTechnicalReportSearch) return true;

      const combined = [
        item.reportNumber,
        item.studentId,
        item.fullName,
        item.campus,
        item.errorArea,
        item.description,
        item.steps,
        item.adminResponse,
        item.status
      ].join(" ").toLowerCase();

      return combined.includes(adminTechnicalReportSearch);
    }

    function renderTechnicalReportCard(reportId, item) {
      const status = item.status || "Open";
      const isArchived = item.archived === true || status === "Closed";

      let statusClass = "status-waiting";
      if (status === "Investigating") statusClass = "status-serving";
      if (status === "Resolved") statusClass = "status-completed";
      if (status === "Closed") statusClass = "status-cancelled";

      const actionButtons = isArchived
        ? `<button class="btn btn-small btn-outline" onclick="reopenTechnicalReport('${reportId}')">Reopen</button>`
        : `
          <button class="btn btn-small btn-blue" onclick="markTechnicalReportInvestigating('${reportId}')">Investigating</button>
          <button class="btn btn-small btn-green" onclick="respondTechnicalReport('${reportId}')">Respond / Resolve</button>
          <button class="btn btn-small btn-outline" onclick="closeTechnicalReport('${reportId}')">Close</button>
        `;

      return `
        <div class="list-item">
          <strong>${safePupassText(item.reportNumber || reportId)}</strong>

          <p>${safePupassText(item.fullName || "")} · ${safePupassText(item.campus || "")}</p>
          <p style="font-size:12px;">Student ID: ${safePupassText(item.studentId || "")}</p>
          <p style="font-size:12px;">Error Area: ${safePupassText(item.errorArea || "")}</p>
          <p style="font-size:12px;">Created: ${safePupassText(formatPupassDateTime(item.createdAt))}</p>

          <p style="font-size:12px;margin-top:8px;"><b>Problem:</b> ${safePupassText(item.description || "")}</p>
          <p style="font-size:12px;margin-top:8px;"><b>Steps:</b> ${safePupassText(item.steps || "")}</p>

          ${
            item.adminResponse
              ? `<p style="font-size:12px;margin-top:8px;"><b>Admin Response:</b> ${safePupassText(item.adminResponse)}</p>`
              : ""
          }

          <span class="status-pill ${statusClass}">${safePupassText(status)}</span>

          <div class="admin-actions">${actionButtons}</div>
        </div>
      `;
    }

    function renderAdminTechnicalReportInbox() {
      const inbox = document.getElementById("adminTechnicalReportInbox");
      if (!inbox) return;

      ensureAdminTechnicalReportControls();

      inbox.innerHTML = `<div class="card"><p>Loading technical reports...</p></div>`;

      if (technicalReportsUnsubscribe) {
        technicalReportsUnsubscribe();
      }

      technicalReportsUnsubscribe = db.collection("technicalReports")
        .orderBy("createdAt", "asc")
        .onSnapshot(function(snapshot) {
          const reports = [];

          snapshot.forEach(function(doc) {
            reports.push({
              id: doc.id,
              data: doc.data()
            });
          });

          const filteredReports = reports.filter(function(record) {
            const item = record.data;
            const isArchived = item.archived === true || item.status === "Closed";

            if (adminTechnicalReportView === "open" && isArchived) return false;
            if (adminTechnicalReportView === "archive" && !isArchived) return false;

            return technicalReportMatchesSearch(item);
          });

          if (!filteredReports.length) {
            inbox.innerHTML = `
              <div class="card gold-card">
                <h2>${adminTechnicalReportView === "archive" ? "No Archived Reports" : "No Open Technical Reports"}</h2>
                <p>No technical reports found for this view.</p>
              </div>
            `;
            return;
          }

          inbox.innerHTML = filteredReports.map(function(record) {
            return renderTechnicalReportCard(record.id, record.data);
          }).join("");
        }, function(error) {
          console.error("Error loading technical reports:", error);

          inbox.innerHTML = `
            <div class="card">
              <h2>Could not load technical reports</h2>
              <p>Please check Firebase rules for the technicalReports collection.</p>
            </div>
          `;
        });
    }

    async function markTechnicalReportInvestigating(reportId) {
      try {
        await db.collection("technicalReports").doc(reportId).update({
          status: "Investigating",
          archived: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating technical report:", error);
        showMessage("Report was not updated.");
      }
    }

    async function respondTechnicalReport(reportId) {
      const response = prompt("Type admin response or resolution note:");

      if (!response || !response.trim()) return;

      try {
        await db.collection("technicalReports").doc(reportId).update({
          adminResponse: response.trim(),
          status: "Resolved",
          archived: false,
          resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Error responding to technical report:", error);
        showMessage("Response was not saved.");
      }
    }

    async function closeTechnicalReport(reportId) {
      const confirmClose = confirm("Close this technical report and move it to Archive?");
      if (!confirmClose) return;

      try {
        await db.collection("technicalReports").doc(reportId).update({
          status: "Closed",
          archived: true,
          closedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Error closing technical report:", error);
        showMessage("Report was not closed.");
      }
    }

    async function reopenTechnicalReport(reportId) {
      const confirmReopen = confirm("Reopen this archived technical report?");
      if (!confirmReopen) return;

      try {
        await db.collection("technicalReports").doc(reportId).update({
          status: "Open",
          archived: false,
          reopenedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        adminTechnicalReportView = "open";
        renderAdminTechnicalReportInbox();
      } catch (error) {
        console.error("Error reopening technical report:", error);
        showMessage("Report was not reopened.");
      }
    }

    window.addEventListener("load", function() {
  setupCalendarDefaults();
  selectServiceDataOnly("registrar");

  auth.onAuthStateChanged(function(user) {
    if (user) {
      openAdminDashboard();
    } else {
      restoreStudentSession();
    }
  });

      const studentIdInput = document.getElementById("studentIdInput");
      const fullNameInput = document.getElementById("fullNameInput");
      const campusInput = document.getElementById("campusInput");

      if (studentIdInput) {
        studentIdInput.addEventListener("input", function() {
          if (this.value.trim() !== "") {
            this.classList.remove("input-error");
            document.getElementById("studentIdError").style.display = "none";
          }
        });
      }

      if (fullNameInput) {
        fullNameInput.addEventListener("input", function() {
          if (this.value.trim() !== "") {
            this.classList.remove("input-error");
            document.getElementById("fullNameError").style.display = "none";
          }
        });
      }

      if (campusInput) {
        campusInput.addEventListener("change", function() {
          if (this.value.trim() !== "") {
            this.classList.remove("input-error");
            document.getElementById("campusError").style.display = "none";
          }
        });
      }
    });
/* Auto logout after inactivity */
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    alert("You have been logged out due to inactivity.");

    if (document.getElementById("admin")?.classList.contains("active")) {
      adminLogout();
    } else {
      studentLogout();
    }
  }, 15 * 60 * 1000); // 15 minutes
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(event => {
  document.addEventListener(event, resetInactivityTimer);
});

resetInactivityTimer();
