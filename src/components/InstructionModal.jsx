import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

const InstructionModal = () => {
  const [show, setShow] = useState(true);

  const handleClose = () => setShow(false);

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Instruções</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Bem-vindo ao nosso aplicativo! Aqui estão algumas instruções para te ajudar:</p>
        <ul>
          <li>Ponto 1: Descrição do que o usuário deve fazer.</li>
          <li>Ponto 2: Detalhes adicionais.</li>
          <li>Ponto 3: Informações finais.</li>
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InstructionModal;
