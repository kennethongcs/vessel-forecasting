/* eslint-disable import/prefer-default-export */
import jsSHA from 'jssha';

const SALT = 'hey there';

export const getHashSalted = (input) => {
  // create new SHA object
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

  // create an unhashed cookie string based on user ID and salt
  const unhashedString = `${input}-${SALT}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
};

export const getHash = (input) => {
  // create new SHA object
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

  // create an unhashed cookie string based on user ID and salt
  const unhashedString = `${input}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
};
