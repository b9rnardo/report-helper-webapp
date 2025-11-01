import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

export default function App() {
  const [soma, setSoma] = useState(0);
  const [count, setCount] = useState(0);
  const [matchedRows, setMatchedRows] = useState([]);
  const [selectedCode, setSelectedCode] = useState(20);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [savedTotals, setSavedTotals] = useState([]);
  const [somaSalvos, setSomaSalvos] = useState(0);
  const [modeloAtual, setModeloAtual] = useState("");
  const [showLinhas, setShowLinhas] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [keySequence, setKeySequence] = useState([]);
  const [globaisFeed, setGlobaisFeed] = useState(false);

  const parseBrazilNumber = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    if (typeof v === "number") return v;
    let s = String(v).trim();
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(s);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("totaisSalvos");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const normalized = parsed
        .map((item) => {
          if (typeof item === "number") return { valor: Number(item), modelo: "" };
          if (item && typeof item === "object")
            return { valor: Number(item.valor ?? 0), modelo: String(item.modelo ?? "") };
          return null;
        })
        .filter(Boolean)
        .filter((it) => !Number.isNaN(it.valor));
      setSavedTotals(normalized);
    } catch {
      setSavedTotals([]);
    }
  }, []);

  useEffect(() => {
    const total = savedTotals.reduce((acc, it) => acc + (Number(it.valor) || 0), 0);
    setSomaSalvos(Number(total.toFixed(2)));
  }, [savedTotals]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const newSeq = [...keySequence, key].slice(-5);
      setKeySequence(newSeq);
      if (newSeq.join("") === "admin") {
        setShowAdmin((prev) => !prev);
        setKeySequence([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keySequence]);

  const processFile = (buffer, codeToUse = selectedCode, globaisAtivo = globaisFeed) => {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet || !sheet["!ref"]) return;

      const range = XLSX.utils.decode_range(sheet["!ref"]);
      let total = 0;
      const matched = [];
      const cellVal = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "";

      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        let valorVendaNum = parseBrazilNumber(cellVal(r, 2));
        const comissaoNum = parseBrazilNumber(cellVal(r, 3));
        const colunaENome = String(cellVal(r, 4)).trim(); 
        const colunaI = String(cellVal(r, 8)).trim(); 
        const colunaA = cellVal(r, 0); 

        if (Number.isNaN(valorVendaNum) || Number.isNaN(comissaoNum)) continue;


        let dataVenda = null;
        if (colunaA) {
          if (colunaA instanceof Date) {
            dataVenda = colunaA;
          } else if (typeof colunaA === "number") {
            dataVenda = new Date(Date.UTC(1900, 0, colunaA - 1));
          } else if (typeof colunaA === "string") {
            const parts = colunaA.split("/");
            if (parts.length === 3) {
              const dia = parseInt(parts[0], 10);
              const mes = parseInt(parts[1], 10) - 1;
              const ano = parseInt(parts[2], 10);
              dataVenda = new Date(ano, mes, dia);
            }
          }
        }

        const dataLimite = new Date(2025, 9, 15);   
        const isDepois = dataVenda && dataVenda > dataLimite;

        const isInternacional = colunaI.toLowerCase() === "internacional" && colunaENome.toLowerCase() === "chat" && isDepois;
        if (isInternacional) valorVendaNum = valorVendaNum / 1.10;

        const centavos = Math.round((valorVendaNum - Math.floor(valorVendaNum)) * 100);
        let match = false;

        if (globaisAtivo) {
          const is00 = (centavos >= 97 || centavos <= 3) && colunaENome === "Postagem";
          const is90 = centavos >= 87 && centavos <= 93;
          match = is00 || is90;
        } else {
          if (codeToUse === 0) {
            match = (centavos >= 97 || centavos <= 3) && colunaENome === "Postagem";
          } else {
            match = centavos >= codeToUse - 3 && centavos <= codeToUse + 3;
          }
        }

        if (match) {
          total += comissaoNum;
          matched.push({
            colunaJ: cellVal(r, 9) ?? "",
            colunaH: cellVal(r, 7) ?? "",
            valorVenda: valorVendaNum,
            centavos: centavos / 100,
            comissao: comissaoNum,
            internacional: isInternacional,
          });
        }
      }

      setSoma(Number(total.toFixed(2)));
      setCount(matched.length);

      if (matched.length > 0) {
        const freq = {};
        matched.forEach((m) => {
          const key = String(m.colunaJ ?? "").trim();
          if (!key) return;
          freq[key] = (freq[key] || 0) + 1;
        });
        const modelo = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        setModeloAtual(modelo);
      } else setModeloAtual("");

      setMatchedRows(matched);
    } catch {
      setMatchedRows([]);
      setSoma(0);
      setCount(0);
      setModeloAtual("");
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      setFileBuffer(buffer);
      processFile(buffer);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCodeChange = (code) => {
    setGlobaisFeed(false);
    setSelectedCode(code);
    if (fileBuffer) processFile(fileBuffer, code, false);
  };

  const handleGlobaisToggle = () => {
    const novoValor = !globaisFeed;
    setGlobaisFeed(novoValor);
    if (fileBuffer) processFile(fileBuffer, selectedCode, novoValor);
  };

  const salvarTotal = () => {
    const modelo = String(modeloAtual ?? "").trim();
    const valor = Number(soma) || 0;
    const key = `${valor.toFixed(2)}|${modelo}`;
    if (savedTotals.some(it => `${Number(it.valor).toFixed(2)}|${String(it.modelo ?? "").trim()}` === key)) {
      alert("Esse par (valor + modelo) já está salvo.");
      return;
    }
    const novos = [...savedTotals, { valor, modelo, globais: globaisFeed }];
    setSavedTotals(novos);
    localStorage.setItem("totaisSalvos", JSON.stringify(novos));
  };

  const limparSalvos = () => {
    if (!window.confirm("Limpar todos os valores salvos?")) return;
    setSavedTotals([]);
    setSomaSalvos(0);
    localStorage.removeItem("totaisSalvos");
  };

  const codes = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <motion.div
      className="container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      <h1 className={showAdmin ? "rainbow-text" : ""}>Report Helper</h1>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      <div className="info">
        <strong>Código de Vendedor:</strong>
        <div className="radio-group">
          {codes.map((code) => (
            <label
              key={code}
              className={showAdmin ? "rainbow-bg" : ""}
              style={{ marginRight: 6 }}
            >
              <input
                type="radio"
                name="centCode"
                checked={selectedCode === code && !globaisFeed}
                onChange={() => handleCodeChange(code)}
              />
              {code.toString().padStart(2, "0")}
            </label>
          ))}

          {showAdmin && (
            <label className={globaisFeed ? "rainbow-bg" : ""} style={{ marginLeft: 10 }}>
              <input
                type="checkbox"
                checked={globaisFeed}
                onChange={handleGlobaisToggle}
                style={{ marginRight: 4 }}
              />
              Globais + Feed
            </label>
          )}
        </div>
      </div>

      <div className="info">
        <strong>Total de vendas:</strong>{" "}
        {soma.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{" "}
        {modeloAtual && <span>({modeloAtual})</span>}
      </div>

      <div className="info">
        <strong>Quantidade de vendas:</strong> {count}
      </div>

      <div className="info">
        <button
          className={showAdmin ? "rainbow-bg" : ""}
          onClick={salvarTotal}
        >
          Salvar total em memória
        </button>
        <button
          className={showAdmin ? "rainbow-bg" : ""}
          style={{ marginLeft: 10 }}
          onClick={limparSalvos}
        >
          Limpar salvos
        </button>
      </div>

      {savedTotals.length > 0 && (
        <div className="info">
          <h3>Valores salvos:</h3>
          <ul>
            {savedTotals.map((item, i) => (
              <li key={i}>
                {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} —{" "}
                {item.modelo || "(sem modelo)"}
              </li>
            ))}
          </ul>
          <strong>Soma dos salvos:</strong>{" "}
          {somaSalvos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
          <br />
          <strong>Comissão estimada:</strong>{" "}
          {(somaSalvos * (globaisFeed ? 0.025 : 0.15)).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          ({globaisFeed ? "2,5%" : "15%"})
        </div>
      )}

      {matchedRows.length > 0 && (
        <div style={{ width: "100%" }}>
          <div className="table-header">
            <h3>Resumo do relatório</h3>
            <button
              className={showAdmin ? "rainbow-bg" : ""}
              onClick={() => setShowLinhas(!showLinhas)}
            >
              {showLinhas ? "▲" : "▼"}
            </button>
          </div>

          <AnimatePresence>
            {showLinhas && (
              <motion.div
                className="table-container"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "300px", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Nome da Modelo</th>
                      <th>Nome do Cliente</th>
                      <th>Valor da venda</th>
                      <th>Código</th>
                      <th>Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedRows.map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.colunaJ}</td>
                        <td>{r.colunaH}</td>
                        <td>
                          {r.valorVenda.toLocaleString("pt-BR", {
                            minimumFractionDigits: r.valorVenda % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {r.internacional && <span style={{ color: "orange" }}>(Internacional)</span>}
                        </td>
                        <td>{r.centavos.toFixed(2).replace(".", ",")}</td>
                        <td>
                          {r.comissao.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAdmin && (
          <motion.div
            className="admin-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5 }}
            style={{ marginTop: 40, padding: 20, background: "#222", color: "#fff", borderRadius: 12 }}
          >
            <h2>Manager Mode</h2>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
