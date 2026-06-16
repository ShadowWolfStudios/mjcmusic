document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#booking-form");
  const message = document.querySelector("#booking-message");

  if (!form) return;

  const formTypeInput = form.querySelector("input[name='formType']");
  const studentFields = document.querySelector(".student-fields");
  const toggleButtons = document.querySelectorAll(".toggle-btn");

  const setFormVariation = (variation) => {
    const isStudent = variation === "student";
    formTypeInput.value = isStudent ? "Student Request" : "General Request";
    studentFields.style.display = isStudent ? "grid" : "none";
    toggleButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.form === variation);
    });
  };

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => setFormVariation(button.dataset.form));
  });

  setFormVariation("student");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const phone = formData.get("phone")?.toString().trim();
    const formType = formData.get("formType")?.toString().trim();
    const studentName = formData.get("studentName")?.toString().trim();
    const grade = formData.get("grade")?.toString().trim();
    const service = formData.get("service")?.toString().trim();
    const date = formData.get("date")?.toString().trim();
    const details = formData.get("message")?.toString().trim();

    if (!name || !email) {
      message.textContent = "Please enter your name and email to send the request.";
      return;
    }

    const subject = encodeURIComponent(`MJC Music Inquiry from ${name}`);
    const bodyLines = [
      `Form type: ${formType}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "Not provided"}`,
    ];

    if (formType === "Student Request") {
      bodyLines.push(`Student Name: ${studentName || "Not provided"}`);
      bodyLines.push(`Student Grade: ${grade || "Not provided"}`);
    }

    bodyLines.push(`Request type: ${service}`);
    bodyLines.push(`Preferred date: ${date || "Flexible"}`);
    bodyLines.push("Message:");
    bodyLines.push(details || "No additional message provided.");

    const body = encodeURIComponent(bodyLines.join("\n"));
    const mailto = `mailto:contact@mjcmusic.org?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    message.textContent = "Your request is ready in your email app. Send it to complete booking.";
  });
});
