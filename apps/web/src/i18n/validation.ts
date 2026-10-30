import { getLanguage, translate } from './index';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Keep native constraint validation, with feedback in the selected language. */
export function localizeValidity(control: FormControl) {
  control.setCustomValidity('');
  if (getLanguage() === 'en' || control.validity.valid) return;
  const validity = control.validity;
  let message = 'Please enter a valid value.';
  if (validity.valueMissing) message = 'Please fill out this field.';
  else if (validity.typeMismatch && 'type' in control && control.type === 'email')
    message = 'Please enter a valid email address.';
  else if (validity.badInput) message = 'Please enter a number.';
  else if (validity.tooShort && 'minLength' in control)
    message = `Please use at least ${control.minLength} characters.`;
  else if (validity.rangeUnderflow && 'min' in control)
    message = `Please enter a value of at least ${control.min}.`;
  else if (validity.rangeOverflow && 'max' in control)
    message = `Please enter a value no greater than ${control.max}.`;
  control.setCustomValidity(translate(message));
}
