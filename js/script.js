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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
  
    message.textContent = "Sending request... 🎵";
  
    try {
      const formData = new FormData(form);
  
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });
  
      const data = await response.json();
  
      if (response.ok && data.success) {
        message.textContent =
          "Request sent! I'll follow up with pricing and next steps 🎶";
  
        form.reset();
        setFormVariation("student");
      } else {
        message.textContent =
          data.message || "Something went wrong sending your request.";
      }
    } catch (err) {
      message.textContent = "Connection issue. Try again.";
    }
  });
});
