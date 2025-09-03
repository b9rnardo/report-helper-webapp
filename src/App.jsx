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

  const parseBrazilNumber = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    if (typeof v === "number") return v;
    let s = String(v).trim();
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
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
          if (item && typeof item === "object") return { valor: Number(item.valor ?? 0), modelo: String(item.modelo ?? "") };
          return null;
        })
        .filter(Boolean)
        .filter((it) => !Number.isNaN(it.valor));
      setSavedTotals(normalized);
    } catch { setSavedTotals([]); }
  }, []);

  useEffect(() => {
    const total = savedTotals.reduce((acc, it) => acc + (Number(it.valor) || 0), 0);
    setSomaSalvos(Number(total.toFixed(2)));
  }, [savedTotals]);

  const processFile = (buffer, codeToUse = selectedCode) => {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet || !sheet["!ref"]) return;

      const range = XLSX.utils.decode_range(sheet["!ref"]);
      let total = 0;
      const matched = [];
      const cellVal = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "";

      for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const valorVendaNum = parseBrazilNumber(cellVal(r, 2));
        const comissaoNum = parseBrazilNumber(cellVal(r, 3));
        if (Number.isNaN(valorVendaNum) || Number.isNaN(comissaoNum)) continue;

        const centavos = Math.round((valorVendaNum - Math.floor(valorVendaNum)) * 100);
        if (centavos >= codeToUse - 2 && centavos <= codeToUse) {
          total += comissaoNum;
          matched.push({
            colunaJ: cellVal(r, 9) ?? "",
            colunaH: cellVal(r, 7) ?? "",
            valorVenda: valorVendaNum,
            centavos: centavos / 100,
            comissao: comissaoNum,
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
    setSelectedCode(code);
    if (fileBuffer) processFile(fileBuffer, code);
  };

  const salvarTotal = () => {
    const modelo = String(modeloAtual ?? "").trim();
    const valor = Number(soma) || 0;
    const key = `${valor.toFixed(2)}|${modelo}`;
    if (savedTotals.some(it => `${Number(it.valor).toFixed(2)}|${String(it.modelo ?? "").trim()}` === key)) {
      alert("Esse par (valor + modelo) já está salvo.");
      return;
    }
    const novos = [...savedTotals, { valor, modelo }];
    setSavedTotals(novos);
    localStorage.setItem("totaisSalvos", JSON.stringify(novos));
  };

  const limparSalvos = () => {
    if (!window.confirm("Limpar todos os valores salvos?")) return;
    setSavedTotals([]);
    setSomaSalvos(0);
    localStorage.removeItem("totaisSalvos");
  };

  const codes = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <motion.div
      className="container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
    >
      <h1>Report Helper</h1>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      <div className="info">
        <strong>Código de Vendedor:</strong>
        <div className="radio-group">
          {codes.map((code) => (
            <label key={code}>
              <input type="radio" name="centCode" checked={selectedCode === code} onChange={() => handleCodeChange(code)} /> {code}
            </label>
          ))}
        </div>
      </div>

      <div className="info">
        <strong>Total de vendas:</strong>{" "}
        {soma.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
        {modeloAtual && <span>({modeloAtual})</span>}
      </div>
      <div className="info">
        <strong>Quantidade de vendas:</strong> {count}
      </div>

      <div className="info">
        <button onClick={salvarTotal}>Salvar total em memória</button>
        <button style={{ marginLeft: 10 }} onClick={limparSalvos}>Limpar salvos</button>
      </div>

      {savedTotals.length > 0 && (
        <div className="info">
          <h3>Valores salvos:</h3>
          <ul>
            {savedTotals.map((item, i) => (
              <li key={i}>
                {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — {item.modelo || "(sem modelo)"}
              </li>
            ))}
          </ul>
          <strong>Soma dos salvos:</strong>{" "}
          {somaSalvos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <br />
          <strong>Comissão estimada:</strong>{" "}
          {(somaSalvos * 0.2).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}

      {matchedRows.length > 0 && (
        <div style={{ width: "100%" }}>
          <div className="table-header">
            <h3>Resumo do relatório</h3>
            <button onClick={() => setShowLinhas(!showLinhas)}>
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
                        <td>{r.valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: r.valorVenda % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}</td>
                        <td>{r.centavos.toFixed(2).replace(".", ",")}</td>
                        <td>{r.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
