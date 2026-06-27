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
  
  message.textContent =
  "Sending request...";
  
  const email =
  document.getElementById("email");
  
  const replyInput =
  form.querySelector(
  'input[name="_replyto"]'
  );
  
  if(replyInput && email){
  replyInput.value =
  email.value;
  }
  
  try{
  
  const response =
  await fetch(
  form.action,
  {
  method:"POST",
  body:new FormData(form),
  headers:{
  Accept:
  "application/json"
  }
  }
  );
  
  if(response.ok){
  
  message.textContent =
  "Request sent! I'll follow up with pricing and next steps 🎵";
  
  form.reset();
  
  setFormVariation(
  "student"
  );
  
  }
  else{
  
  message.textContent =
  "Couldn't send request.";
  
  }
  
  }catch{
  
  message.textContent =
  "Connection issue. Try again.";
  
  }
  
  });
});
